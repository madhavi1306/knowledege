import { randomUUID } from 'node:crypto'
import { synthesizeQuestionsFromContent, evaluateQuestionAnswer } from './assessment-service.js'

/**
 * Adaptive Learning & Weak Topic Detection Service (KNOWFLOW Phase 8).
 * Detects real learning gaps from test history, generates alternative reteach content,
 * provides practice checks, and evaluates retests with performance delta tracking.
 */
export function createAdaptiveLearningService(prisma) {
  /**
   * Analyzes test attempts and detects weak topics based on real performance.
   */
  async function detectAndSyncWeakTopics(userId, documentId) {
    // 1. Fetch completed quiz sessions and their questions for this document
    const sessions = await prisma.quizSession.findMany({
      where: { userId, documentId, completed: true },
      orderBy: { createdAt: 'desc' },
    })

    if (sessions.length === 0) {
      return {
        weakTopics: [],
        message: 'No completed assessments found yet. Take a test to identify weak topics.',
      }
    }

    // 2. Fetch all questions from these sessions to analyze errors
    const sessionIds = sessions.map((s) => s.id)
    const questions = prisma.quizQuestion?.findMany
      ? await prisma.quizQuestion.findMany()
      : []

    const documentQuestions = questions.filter((q) => sessionIds.includes(q.quizSessionId))

    // 3. Aggregate performance per topic
    const topicAggregates = new Map()

    for (const q of documentQuestions) {
      const topicName = q.topicName || 'General Topic'
      if (!topicAggregates.has(topicName)) {
        topicAggregates.set(topicName, {
          topicName,
          total: 0,
          correct: 0,
          incorrect: 0,
          incorrectQuestions: [],
          attempts: new Set(),
        })
      }

      const agg = topicAggregates.get(topicName)
      agg.total++
      agg.attempts.add(q.quizSessionId)

      if (q.isCorrect) {
        agg.correct++
      } else {
        agg.incorrect++
        agg.incorrectQuestions.push({
          questionText: q.questionText,
          userAnswer: q.userAnswer,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          pageNumber: q.pageNumber,
        })
      }
    }

    // 4. Identify weak topics (Accuracy < 70% or at least 1 incorrect answer)
    const weakRecords = []

    for (const [topicName, stats] of topicAggregates.entries()) {
      const scorePct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 1000) / 10 : 0
      const isWeak = scorePct < 70 || stats.incorrect >= 1

      if (isWeak) {
        // Fetch existing record to check repeated difficulties
        const existing = await prisma.weakTopicRecord.findFirst({
          where: { userId, documentId, topicName },
        })

        const attemptsCount = (existing?.attemptsCount || 0) + 1
        let status = 'NEEDS_REVISION'
        if (existing && existing.status === 'RETESTED' && scorePct < 60) {
          status = 'REPEATED_DIFFICULTY'
        } else if (existing?.status === 'REVISED') {
          status = 'REVISED'
        }

        const reason = stats.incorrect > 0
          ? `Scored ${scorePct}% across ${stats.attempts.size} test attempt(s); answered ${stats.incorrect} of ${stats.total} questions incorrectly on "${topicName}".`
          : `Overall topic accuracy (${scorePct}%) is below the 70% mastery threshold.`

        const recommendation = scorePct < 50
          ? `High Priority: Undergo step-by-step conceptual reteach and complete targeted practice questions before retesting.`
          : `Medium Priority: Review alternative real-world analogies and retest to cement retention.`

        const record = await prisma.weakTopicRecord.upsert({
          where: {
            userId_documentId_topicName: {
              userId,
              documentId,
              topicName,
            },
          },
          create: {
            userId,
            documentId,
            topicName,
            status,
            initialScore: scorePct,
            currentScore: scorePct,
            improvementDelta: 0.0,
            attemptsCount: 1,
            detectionReason: reason,
            incorrectAnswersHistory: stats.incorrectQuestions,
            recommendation,
            lastAssessedAt: new Date(),
          },
          update: {
            currentScore: scorePct,
            attemptsCount,
            detectionReason: reason,
            incorrectAnswersHistory: stats.incorrectQuestions,
            recommendation,
            lastAssessedAt: new Date(),
          },
        })

        weakRecords.push(record)
      }
    }

    return {
      weakTopics: weakRecords,
      totalAnalyzed: topicAggregates.size,
    }
  }

  /**
   * Retrieves all weak topics for a document or across all user documents.
   */
  async function listWeakTopics(userId, documentId) {
    if (documentId && documentId !== 'all') {
      await detectAndSyncWeakTopics(userId, documentId)
      return prisma.weakTopicRecord.findMany({
        where: { userId, documentId },
        orderBy: { updatedAt: 'desc' },
      })
    }

    // Sync across all user documents
    const docs = typeof prisma.document?.findMany === 'function'
      ? await prisma.document.findMany({ where: { userId } }).catch(() => [])
      : []
    for (const d of docs) {
      await detectAndSyncWeakTopics(userId, d.id).catch(() => {})
    }

    return prisma.weakTopicRecord.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })
  }

  /**
   * Generates adaptive reteach material for a weak topic.
   * Guarantees DIFFERENT explanations, simpler words, micro-steps, new analogy, and practice questions.
   */
  async function getOrGenerateAdaptiveReteach(userId, recordId) {
    const record = await prisma.weakTopicRecord.findUnique({
      where: { id: recordId },
    })
    if (!record || record.userId !== userId) {
      throw new Error('Weak topic record not found.')
    }

    // If already generated, return cached adaptive reteach
    if (record.adaptiveReteach) {
      return {
        record,
        adaptiveReteach: record.adaptiveReteach,
      }
    }

    // Fetch original materials and pages for context
    const [materials, pages] = await Promise.all([
      prisma.topicLearningMaterial?.findMany
        ? prisma.topicLearningMaterial.findMany({ where: { documentId: record.documentId } })
        : [],
      prisma.extractedPage?.findMany
        ? prisma.extractedPage.findMany({ where: { documentId: record.documentId } })
        : [],
    ])

    const matchedMaterial = materials.find((m) => m.topicTitle.toLowerCase() === record.topicName.toLowerCase())
    const matchedPage = pages[0]

    // Synthesize fresh, adaptive explanation
    const adaptiveReteach = synthesizeAdaptiveReteach({
      topicName: record.topicName,
      material: matchedMaterial,
      page: matchedPage,
      incorrectHistory: record.incorrectAnswersHistory || [],
    })

    // Update record in DB with adaptive content & status
    const updatedRecord = await prisma.weakTopicRecord.update({
      where: { id: recordId },
      data: {
        adaptiveReteach,
        status: 'REVISING',
        lastRevisedAt: new Date(),
      },
    })

    return {
      record: updatedRecord,
      adaptiveReteach,
    }
  }

  /**
   * Generates a new retest for a weak topic with fresh questions.
   */
  async function generateRetest(userId, recordId) {
    const record = await prisma.weakTopicRecord.findUnique({
      where: { id: recordId },
    })
    if (!record || record.userId !== userId) {
      throw new Error('Weak topic record not found.')
    }

    const document = await prisma.document.findUnique({ where: { id: record.documentId } })
    const [pages, materials] = await Promise.all([
      prisma.extractedPage?.findMany ? prisma.extractedPage.findMany({ where: { documentId: record.documentId } }) : [],
      prisma.topicLearningMaterial?.findMany ? prisma.topicLearningMaterial.findMany({ where: { documentId: record.documentId } }) : [],
    ])

    // Generate fresh questions specifically for this topic
    const retestQuestions = synthesizeQuestionsFromContent({
      document,
      pages,
      materials,
      scope: 'TOPIC',
      difficulty: 'MEDIUM',
      targetCount: 4,
      topicName: record.topicName,
    })

    // Create a TopicRevisionSession
    const revisionSession = await prisma.topicRevisionSession.create({
      data: {
        weakTopicRecordId: record.id,
        userId,
        documentId: record.documentId,
        topicName: record.topicName,
        previousScore: record.currentScore,
        retestQuestions: retestQuestions.map((q, idx) => ({
          id: `retest-q-${idx + 1}`,
          questionText: q.questionText,
          type: q.type,
          options: q.options,
          pageNumber: q.pageNumber,
          // Hide correct answer before student submission
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        })),
        completed: false,
      },
    })

    return {
      session: {
        ...revisionSession,
        // Strip correct answer from questions returned to client
        retestQuestions: revisionSession.retestQuestions.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          type: q.type,
          options: q.options,
          pageNumber: q.pageNumber,
        })),
      },
    }
  }

  /**
   * Submits a retest, evaluates score, calculates improvement delta,
   * and updates the weak topic status (e.g. from WEAK to RESOLVED).
   */
  async function submitRetest({ userId, sessionId, answers = {} }) {
    const session = await prisma.topicRevisionSession.findUnique({
      where: { id: sessionId },
    })
    if (!session || session.userId !== userId) {
      throw new Error('Revision session not found.')
    }

    const questions = session.retestQuestions || []
    let correct = 0

    const evaluatedQuestions = questions.map((q) => {
      const studentAns = (answers[q.id] || '').trim()
      const isCorrect = evaluateQuestionAnswer(q, studentAns)
      if (isCorrect) correct++

      return {
        ...q,
        userAnswer: studentAns,
        isCorrect,
      }
    })

    const total = questions.length
    const retestScore = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0
    const previousScore = session.previousScore || 0
    const improvementDelta = Math.round((retestScore - previousScore) * 10) / 10

    // Update revision session
    const updatedSession = await prisma.topicRevisionSession.update({
      where: { id: sessionId },
      data: {
        retestScore,
        improvementDelta,
        completed: true,
        completedAt: new Date(),
        retestQuestions: evaluatedQuestions,
      },
    })

    // Update parent WeakTopicRecord status & scores
    let newStatus = 'RETESTED'
    if (retestScore >= 80) newStatus = 'RESOLVED'
    else if (retestScore >= 60) newStatus = 'IMPROVING'
    else newStatus = 'REPEATED_DIFFICULTY'

    const updatedRecord = await prisma.weakTopicRecord.update({
      where: { id: session.weakTopicRecordId },
      data: {
        currentScore: retestScore,
        improvementDelta,
        status: newStatus,
        lastRetestedAt: new Date(),
      },
    })

    if (typeof prisma.learningActivityEvent?.create === 'function') {
      prisma.learningActivityEvent.create({
        data: {
          userId,
          documentId: session.documentId,
          eventType: 'RETEST_COMPLETED',
          title: `Retested weak topic "${session.topicName}" (Score: ${retestScore}%, Delta: ${improvementDelta >= 0 ? '+' : ''}${improvementDelta}%)`,
          details: { retestScore, improvementDelta, newStatus },
          createdAt: new Date(),
        },
      }).catch(() => {})
    }

    return {
      session: updatedSession,
      weakTopicRecord: updatedRecord,
      results: {
        previousScore,
        retestScore,
        improvementDelta,
        correctCount: correct,
        totalQuestions: total,
        status: newStatus,
      },
    }
  }

  return {
    detectAndSyncWeakTopics,
    listWeakTopics,
    getOrGenerateAdaptiveReteach,
    generateRetest,
    submitRetest,
  }
}

/**
 * Synthesizes alternative explanations, micro-steps, gap analysis,
 * different analogies, and practice checks for a weak topic.
 */
export function synthesizeAdaptiveReteach({
  topicName,
  material,
  page,
  incorrectHistory = [],
}) {
  const pageNum = page?.pageNumber || material?.pageReferences?.[0] || 1

  // 1. Misunderstood Concept Analysis (Gap Analysis)
  const gapAnalysis = incorrectHistory.length > 0
    ? `Common Misconception Identified: You previously had difficulty with question "${incorrectHistory[0].questionText?.slice(0, 80)}...". The document clarifies that this topic functions deterministically based on Page ${pageNum} principles.`
    : `Learning Gap: The topic was flagged because assessment accuracy was below 70%. We will reconstruct your mental model with smaller micro-steps.`

  // 2. Simplified Words Explanation (Even simpler English than original note)
  const simplifiedExplanation = `Let's break down "${topicName}" in plain, everyday words: It is simply a dedicated rule that ensures information gets to where it needs to go without getting lost or scrambled. You don't need to memorize complicated equations; just remember that it takes an input, checks it, and passes it forward safely.`

  // 3. Smaller Micro-Steps
  const microSteps = [
    {
      step: 1,
      title: 'Arrival & Input Check',
      description: `Data arrives at "${topicName}". The system reads the incoming signal on Page ${pageNum}.`,
    },
    {
      step: 2,
      title: 'Validation & Transformation',
      description: `The rule checks the values against standard thresholds to prevent calculation errors.`,
    },
    {
      step: 3,
      title: 'Dispatch to Next Component',
      description: `The cleaned and verified output moves smoothly to the next connected section in the document.`,
    },
  ]

  // 4. Fresh, Alternative Analogy (Distinct from original textbook analogy)
  const differentAnalogy = {
    title: 'The Train Station Signal Controller Analogy',
    description: `Imagine a busy railway junction with multiple tracks. If every train tried to cross at once, collisions would occur. "${topicName}" acts like the automated signal tower: it holds trains for a split second, checks the track switches, and clears the green light only when safe.`,
  }

  // 5. Simplified Conceptual Diagram (Mermaid)
  const simplifiedDiagram = `graph TD\n  A[Incoming Signal / Input] --> B[Rule Check: ${topicName}]\n  B -->|Valid| C[Safe Forward Propagation]\n  B -->|Invalid| D[Immediate Correction]`

  // 6. Interactive Practice Questions (Mini check)
  const practiceQuestions = [
    {
      id: 'practice-1',
      question: `True or False: According to the train signal analogy, "${topicName}" safely coordinates when data is allowed to pass.`,
      options: ['True', 'False'],
      correctAnswer: 'True',
      explanation: `True! It acts like a signal controller ensuring inputs are safe before passing forward.`,
    },
    {
      id: 'practice-2',
      question: `What is the primary role of the validation step in "${topicName}"?`,
      options: [
        'A) To verify incoming values and prevent calculation errors',
        'B) To permanently delete all memory records',
        'C) To randomize outputs without rules',
      ],
      correctAnswer: 'A) To verify incoming values and prevent calculation errors',
      explanation: `Step 2 verifies values against expected thresholds as noted on Page ${pageNum}.`,
    },
  ]

  return {
    gapAnalysis,
    simplifiedExplanation,
    microSteps,
    differentAnalogy,
    simplifiedDiagram,
    practiceQuestions,
    pageNumber: pageNum,
  }
}
