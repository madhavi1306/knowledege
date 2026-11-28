import { HttpError } from '../utils/http-error.js'

/**
 * Free Spaced Repetition Scheduler (FSRS) implementation.
 * Calculates optimal review intervals based on stability (S), difficulty (D), and rating (1: Again, 2: Hard, 3: Good, 4: Easy).
 */
export function calculateFsrsNextState({ stability = 1.0, difficulty = 5.0, reps = 0, lapses = 0 }, rating = 3) {
  // Clamp rating between 1 and 4
  const grade = Math.min(4, Math.max(1, rating))

  let newD = difficulty - 0.5 * (grade - 3)
  newD = Math.min(10, Math.max(1, newD)) // Clamp difficulty between 1 and 10

  let newS = stability
  let newReps = reps + 1
  let newLapses = lapses

  if (grade === 1) {
    // Again / Failure
    newLapses += 1
    newS = Math.max(0.5, stability * 0.4)
  } else if (grade === 2) {
    // Hard
    newS = Math.max(1.0, stability * 1.2)
  } else if (grade === 3) {
    // Good
    newS = Math.max(1.5, stability * (1 + (11 - newD) * 0.35))
  } else {
    // Easy
    newS = Math.max(2.5, stability * (1 + (11 - newD) * 0.65))
  }

  // Interval in days is approximately proportional to stability
  const intervalDays = Math.max(1, Math.round(newS))
  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays)

  // Estimated retention probability (retrievability R = exp(-t/S))
  const retentionScore = Math.min(1.0, Math.max(0.2, Math.exp(-1 / Math.max(1, newS))))

  return {
    stability: Number(newS.toFixed(2)),
    difficulty: Number(newD.toFixed(2)),
    reps: newReps,
    lapses: newLapses,
    intervalDays,
    nextReviewDate,
    retentionScore: Number(retentionScore.toFixed(2)),
  }
}

export function createSpacedRepetitionService(prisma) {
  return {
    /**
     * Get daily revision queue (due, overdue, upcoming)
     */
    getDailyRevisionQueue: async (userId) => {
      const now = new Date()

      // Fetch or seed spaced review records for all user concepts
      const userConcepts = await prisma.concept.findMany({
        where: { userId },
        include: {
          mastery: true,
          spacedReview: true,
          topics: { include: { topic: true } },
        },
      })

      const queue = []
      for (const concept of userConcepts) {
        let review = concept.spacedReview
        if (!review) {
          // Initialize spaced review entry
          const initialFsrs = calculateFsrsNextState({}, 3)
          review = await prisma.spacedReview.create({
            data: {
              userId,
              conceptId: concept.id,
              stability: initialFsrs.stability,
              difficulty: initialFsrs.difficulty,
              reps: 0,
              lapses: 0,
              nextReviewDate: initialFsrs.nextReviewDate,
              retentionScore: initialFsrs.retentionScore,
            },
          })
        }

        const isDue = new Date(review.nextReviewDate) <= now
        const isOverdue = new Date(review.nextReviewDate) < new Date(now.getTime() - 24 * 3600 * 1000)

        queue.push({
          id: review.id,
          conceptId: concept.id,
          conceptName: concept.name,
          definition: concept.definition,
          simpleExplanation: concept.simpleExplanation,
          analogy: concept.analogy,
          stability: review.stability,
          difficulty: review.difficulty,
          reps: review.reps,
          lapses: review.lapses,
          nextReviewDate: review.nextReviewDate,
          retentionScore: review.retentionScore,
          masteryStatus: concept.mastery?.status || 'NOT_LEARNED',
          masteryScore: concept.mastery?.masteryScore || 0,
          isDue,
          isOverdue,
          topicName: concept.topics?.[0]?.topic?.name || 'General',
        })
      }

      const dueList = queue.filter((item) => item.isDue)
      const upcomingList = queue.filter((item) => !item.isDue).sort((a, b) => new Date(a.nextReviewDate) - new Date(b.nextReviewDate))

      return {
        dueCount: dueList.length,
        totalTracked: queue.length,
        due: dueList,
        upcoming: upcomingList.slice(0, 10),
      }
    },

    /**
     * Submit an FSRS review evaluation for a concept (1: Again, 2: Hard, 3: Good, 4: Easy)
     */
    recordReview: async (userId, conceptId, rating = 3) => {
      let current = await prisma.spacedReview.findUnique({
        where: { conceptId },
      })

      if (!current) {
        current = { stability: 1.0, difficulty: 5.0, reps: 0, lapses: 0 }
      }

      const nextState = calculateFsrsNextState(current, rating)

      const updated = await prisma.spacedReview.upsert({
        where: { conceptId },
        create: {
          userId,
          conceptId,
          ...nextState,
          lastReviewDate: new Date(),
        },
        update: {
          ...nextState,
          lastReviewDate: new Date(),
        },
      })

      // Also adjust concept mastery based on recall success
      const masteryDelta = rating === 1 ? -15 : rating === 2 ? 5 : rating === 3 ? 15 : 25
      const newStatus = rating === 1 ? 'WEAK' : rating >= 3 ? 'MASTERED' : 'IMPROVING'

      await prisma.conceptMastery.upsert({
        where: { conceptId },
        create: {
          userId,
          conceptId,
          status: newStatus,
          masteryScore: Math.max(0, 50 + masteryDelta),
          totalAttempts: 1,
          correctAttempts: rating >= 2 ? 1 : 0,
          lastAssessedAt: new Date(),
        },
        update: {
          status: newStatus,
          masteryScore: { increment: masteryDelta },
          totalAttempts: { increment: 1 },
          correctAttempts: rating >= 2 ? { increment: 1 } : undefined,
          lastAssessedAt: new Date(),
        },
      })

      return updated
    },

    /**
     * Get multi-metric learning progress dashboard analytics
     */
    getProgressAnalytics: async (userId) => {
      const documentsCount = await prisma.document.count({ where: { userId } })
      const concepts = await prisma.concept.findMany({
        where: { userId },
        include: { mastery: true, spacedReview: true },
      })

      const totalConcepts = concepts.length
      let learnedCount = 0
      let weakCount = 0
      let masteredCount = 0
      let revisionRequiredCount = 0
      let totalMasteryScore = 0
      let totalRetentionScore = 0

      for (const c of concepts) {
        const m = c.mastery
        const s = c.spacedReview
        if (m) {
          totalMasteryScore += m.masteryScore || 0
          if (m.status === 'MASTERED') masteredCount++
          else if (m.status === 'WEAK') weakCount++
          else if (m.status === 'REVISION_REQUIRED') revisionRequiredCount++
          if (m.status !== 'NOT_LEARNED') learnedCount++
        }
        if (s) {
          totalRetentionScore += s.retentionScore || 1.0
        }
      }

      const avgMastery = totalConcepts > 0 ? Math.round(totalMasteryScore / totalConcepts) : null
      const avgRetention = totalConcepts > 0 ? Math.round((totalRetentionScore / totalConcepts) * 100) : null

      // Quiz analytics
      const quizSessions = await prisma.quizSession.findMany({
        where: { userId, completed: true },
        orderBy: { completedAt: 'desc' },
        take: 10,
      })

      const avgQuizScore = quizSessions.length > 0
        ? Math.round(quizSessions.reduce((acc, q) => acc + q.scorePercentage, 0) / quizSessions.length)
        : null

      // Recovery analytics
      const recoverySessions = await prisma.recoverySession.findMany({
        where: { userId },
        include: { steps: true },
      })
      const totalRecoverySteps = recoverySessions.reduce((acc, r) => acc + r.steps.length, 0)
      const resolvedRecoverySteps = recoverySessions.reduce(
        (acc, r) => acc + r.steps.filter((s) => s.status === 'MASTERED').length,
        0
      )
      const recoveryProgress = totalRecoverySteps > 0
        ? Math.round((resolvedRecoverySteps / totalRecoverySteps) * 100)
        : null

      return {
        overview: {
          totalDocuments: documentsCount,
          totalConcepts,
          learnedConcepts: learnedCount,
          masteredConcepts: masteredCount,
          weakConcepts: weakCount,
          revisionRequired: revisionRequiredCount,
          conceptMasteryRate: avgMastery,
          retentionRate: avgRetention,
          averageQuizScore: avgQuizScore,
          recoveryRate: recoveryProgress,
          learningStreakDays: null,
        },
        quizHistory: quizSessions.map((q) => ({
          id: q.id,
          mode: q.mode,
          scorePercentage: q.scorePercentage,
          completedAt: q.completedAt,
          totalQuestions: q.totalQuestions,
        })),
      }
    },
  }
}
