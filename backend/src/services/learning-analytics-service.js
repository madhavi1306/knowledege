import { HttpError } from '../utils/http-error.js'

/**
 * KNOWFLOW Phase 9: Overall Learning Dashboard & Progress Analytics Service
 * Computes strictly grounded learning analytics, document-level progress,
 * topic mastery, test performance trends, and revision activity without mock data.
 */
export function createLearningAnalyticsService(prisma) {
  /**
   * Records a verifiable student learning activity event
   */
  async function recordActivityEvent(userId, { documentId = null, topicId = null, eventType, title, details = null }) {
    if (!userId || !eventType || !title) {
      throw new HttpError(400, 'userId, eventType, and title are required to log learning activity.')
    }

    if (typeof prisma.learningActivityEvent?.create === 'function') {
      return prisma.learningActivityEvent.create({
        data: {
          userId,
          documentId,
          topicId,
          eventType,
          title,
          details: details ? (typeof details === 'object' ? details : { info: details }) : null,
          createdAt: new Date(),
        },
      })
    }
    return null
  }

  /**
   * Transparent learning completion criteria:
   * A topic is verified COMPLETED if:
   * 1. The student explicitly finished the topic notes and marked it COMPLETED, OR
   * 2. The student scored >= 80% on a test covering this topic.
   * A topic is NOT considered completed merely because it was opened.
   */
  function evaluateTopicCompletion({ material, highestTestScore, revisionRecord }) {
    if (material && material.status === 'COMPLETED') {
      return {
        completed: true,
        completionCriteria: 'Marked completed by learner after structured notes study',
      }
    }
    if (highestTestScore !== null && highestTestScore >= 80) {
      return {
        completed: true,
        completionCriteria: `Mastered via assessment score (${highestTestScore}%)`,
      }
    }
    if (revisionRecord && revisionRecord.status === 'RESOLVED') {
      return {
        completed: true,
        completionCriteria: `Concept difficulty resolved via adaptive retest (${revisionRecord.currentScore}%)`,
      }
    }
    if (material && material.status === 'IN_PROGRESS') {
      return {
        completed: false,
        completionCriteria: 'In progress: actively studying structured material',
      }
    }
    return {
      completed: false,
      completionCriteria: 'Not completed: requires study or assessment verification',
    }
  }

  /**
   * Compiles the complete learning dashboard analytics for the authenticated student
   */
  async function getDashboardAnalytics(userId) {
    if (!userId) throw new HttpError(401, 'User must be authenticated.')

    // 1. Fetch all raw student entities
    const [
      documents,
      materials,
      quizSessions,
      weakRecords,
      revisionSessions,
      activityEvents,
    ] = await Promise.all([
      prisma.document.findMany({
        where: { userId },
        orderBy: { uploadedAt: 'desc' },
      }),
      typeof prisma.topicLearningMaterial?.findMany === 'function'
        ? prisma.topicLearningMaterial.findMany({ where: { userId } })
        : [],
      typeof prisma.quizSession?.findMany === 'function'
        ? prisma.quizSession.findMany({
            where: { userId, completed: true },
            orderBy: { completedAt: 'desc' },
          })
        : [],
      typeof prisma.weakTopicRecord?.findMany === 'function'
        ? prisma.weakTopicRecord.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
          })
        : [],
      typeof prisma.topicRevisionSession?.findMany === 'function'
        ? prisma.topicRevisionSession.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
          })
        : [],
      typeof prisma.learningActivityEvent?.findMany === 'function'
        ? prisma.learningActivityEvent.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 40,
          })
        : [],
    ])

    // Load topics for user's documents
    const docIds = documents.map((d) => d.id)
    const rawTopics = typeof prisma.topic?.findMany === 'function'
      ? await prisma.topic.findMany({})
      : []

    // Map documents to their topics
    const documentNameMap = new Map(documents.map((d) => [d.id, d.fileName]))
    const documentAnalysisIds = new Set(
      documents.map((d) => d.id) // fallback
    )

    // Match materials to document & topic
    const materialsByDocId = new Map()
    for (const m of materials) {
      if (!materialsByDocId.has(m.documentId)) materialsByDocId.set(m.documentId, [])
      materialsByDocId.get(m.documentId).push(m)
    }

    const quizByDocId = new Map()
    for (const q of quizSessions) {
      if (!quizByDocId.has(q.documentId)) quizByDocId.set(q.documentId, [])
      quizByDocId.get(q.documentId).push(q)
    }

    const weakByDocId = new Map()
    for (const w of weakRecords) {
      if (!weakByDocId.has(w.documentId)) weakByDocId.set(w.documentId, [])
      weakByDocId.get(w.documentId).push(w)
    }

    const revisionByDocId = new Map()
    for (const r of revisionSessions) {
      if (!revisionByDocId.has(r.documentId)) revisionByDocId.set(r.documentId, [])
      revisionByDocId.get(r.documentId).push(r)
    }

    // 2. Compute Document-by-Document Progress
    const documentProgressList = []
    let totalAllTopics = 0
    let totalAllCompletedTopics = 0

    for (const doc of documents) {
      const docMaterials = materialsByDocId.get(doc.id) || []
      const docQuizzes = quizByDocId.get(doc.id) || []
      const docWeak = weakByDocId.get(doc.id) || []

      // Identify topics belonging to this document
      // Priority: from topicLearningMaterials, then rawTopics matching name/doc
      const topicTitles = new Set(docMaterials.map((m) => m.topicTitle))
      if (topicTitles.size === 0) {
        // Fallback: use document title as at least 1 topic if uploaded
        topicTitles.add(doc.fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' '))
      }

      const totalDocTopics = Math.max(docMaterials.length, topicTitles.size)
      totalAllTopics += totalDocTopics

      // Completed topics in this document
      let completedDocTopics = 0
      for (const m of docMaterials) {
        if (m.status === 'COMPLETED') completedDocTopics++
      }

      totalAllCompletedTopics += completedDocTopics
      const remainingDocTopics = Math.max(0, totalDocTopics - completedDocTopics)

      // Test stats for this document
      const testsAttempted = docQuizzes.length
      const avgScore = testsAttempted > 0
        ? Math.round((docQuizzes.reduce((sum, q) => sum + (q.scorePercentage || 0), 0) / testsAttempted) * 10) / 10
        : null

      const progressPct = totalDocTopics > 0
        ? Math.min(100, Math.round((completedDocTopics / totalDocTopics) * 100))
        : 0

      // Active weak topics in this document
      const activeWeakCount = docWeak.filter(
        (w) => w.status === 'NEEDS_REVISION' || w.status === 'REPEATED_DIFFICULTY' || w.status === 'REVISING'
      ).length

      // Document study state
      const isStudied = completedDocTopics > 0 || docMaterials.some((m) => m.status === 'IN_PROGRESS') || testsAttempted > 0

      documentProgressList.push({
        documentId: doc.id,
        documentName: doc.fileName,
        fileSize: doc.fileSize,
        uploadStatus: doc.uploadStatus,
        uploadedAt: doc.uploadedAt,
        totalTopics: totalDocTopics,
        topicsCompleted: completedDocTopics,
        topicsRemaining: remainingDocTopics,
        documentLearningProgress: progressPct,
        testsAttempted,
        score: avgScore,
        weakTopics: activeWeakCount,
        studied: isStudied,
        status: completedDocTopics === totalDocTopics && totalDocTopics > 0 ? 'COMPLETED' : (isStudied ? 'IN_PROGRESS' : 'READY_TO_LEARN'),
      })
    }

    // 3. Overall Dashboard Metric Summary
    const totalDocs = documents.length
    const docsProcessing = documents.filter((d) => d.uploadStatus === 'PROCESSING').length
    const docsReady = documents.filter((d) => d.uploadStatus === 'ANALYSIS_COMPLETED' || d.uploadStatus === 'UPLOADED').length
    const docsStudied = documentProgressList.filter((d) => d.studied).length

    const overallProgress = totalAllTopics > 0
      ? Math.round((totalAllCompletedTopics / totalAllTopics) * 100)
      : 0

    // Unique topics revised
    const revisedTopicNames = new Set([
      ...revisionSessions.map((r) => r.topicName.toLowerCase()),
      ...weakRecords.filter((w) => w.lastRetestedAt || w.lastRevisedAt).map((w) => w.topicName.toLowerCase()),
    ])

    const totalWeakActive = weakRecords.filter(
      (w) => w.status === 'NEEDS_REVISION' || w.status === 'REPEATED_DIFFICULTY' || w.status === 'REVISING'
    ).length

    // Test performance aggregation
    const totalTests = quizSessions.length
    const avgTestScore = totalTests > 0
      ? Math.round((quizSessions.reduce((acc, q) => acc + (q.scorePercentage || 0), 0) / totalTests) * 10) / 10
      : null

    const passedTests = quizSessions.filter((q) => (q.scorePercentage || 0) >= 60).length
    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0
    const highestScore = totalTests > 0 ? Math.max(...quizSessions.map((q) => q.scorePercentage || 0)) : 0

    // 4. Topic Progress Breakdown (Transparent tracking per topic)
    const topicProgressItems = []
    const seenTopicKeys = new Set()

    for (const doc of documents) {
      const docMaterials = materialsByDocId.get(doc.id) || []
      const docQuizzes = quizByDocId.get(doc.id) || []
      const docWeak = weakByDocId.get(doc.id) || []
      const docRevisions = revisionByDocId.get(doc.id) || []

      for (const m of docMaterials) {
        const key = `${doc.id}::${m.topicTitle.toLowerCase()}`
        if (seenTopicKeys.has(key)) continue
        seenTopicKeys.add(key)

        // Find associated quizzes that tested this topic
        const topicQuizzes = docQuizzes.filter((q) =>
          q.topicBreakdown && Array.isArray(q.topicBreakdown) &&
          q.topicBreakdown.some((tb) => tb.topicName?.toLowerCase() === m.topicTitle.toLowerCase())
        )

        const topicScores = topicQuizzes.map((q) => {
          const matched = q.topicBreakdown.find((tb) => tb.topicName?.toLowerCase() === m.topicTitle.toLowerCase())
          return matched ? matched.scorePercentage : q.scorePercentage
        })
        const highestTestScore = topicScores.length > 0 ? Math.max(...topicScores) : null

        // Check weak record & revision
        const weakRecord = docWeak.find((w) => w.topicName.toLowerCase() === m.topicTitle.toLowerCase())
        const revSession = docRevisions.find((r) => r.topicName.toLowerCase() === m.topicTitle.toLowerCase())

        const completionEval = evaluateTopicCompletion({
          material: m,
          highestTestScore,
          revisionRecord: weakRecord,
        })

        topicProgressItems.push({
          topicId: m.topicId,
          documentId: doc.id,
          documentName: doc.fileName,
          topicTitle: m.topicTitle,
          chapterTitle: m.chapterTitle || 'Chapter 1',
          status: completionEval.completed ? 'COMPLETED' : m.status,
          opened: true,
          learningActivity: m.status !== 'NOT_STARTED',
          completionCriteria: completionEval.completionCriteria,
          testPerformance: highestTestScore !== null ? `${highestTestScore}%` : 'Unassessed',
          isWeak: weakRecord ? (weakRecord.status === 'NEEDS_REVISION' || weakRecord.status === 'REPEATED_DIFFICULTY') : false,
          revisionStatus: weakRecord ? weakRecord.status : (revSession ? 'RETESTED' : 'NONE'),
          improvementDelta: weakRecord?.improvementDelta || revSession?.improvementDelta || 0.0,
          updatedAt: m.updatedAt || m.lastGeneratedAt,
        })
      }
    }

    // 5. Analytics Visualizations Data

    // A. Test performance history (Chronological order)
    const testPerformanceChart = [...quizSessions].reverse().map((q, idx) => ({
      id: q.id,
      testIndex: idx + 1,
      documentName: documentNameMap.get(q.documentId) || 'Document Assessment',
      documentId: q.documentId,
      scorePercentage: q.scorePercentage,
      totalQuestions: q.totalQuestions,
      correctCount: q.correctCount,
      completedAt: q.completedAt,
    }))

    // B. Topic Mastery Distribution
    let strongTopicsCount = 0
    let improvingTopicsCount = 0
    let weakTopicsCount = 0
    let unassessedTopicsCount = 0

    for (const t of topicProgressItems) {
      if (t.isWeak) {
        weakTopicsCount++
      } else if (t.status === 'COMPLETED' || (t.testPerformance !== 'Unassessed' && parseFloat(t.testPerformance) >= 80)) {
        strongTopicsCount++
      } else if (t.testPerformance !== 'Unassessed' && parseFloat(t.testPerformance) >= 60) {
        improvingTopicsCount++
      } else {
        unassessedTopicsCount++
      }
    }

    // C. Weak Topic Status Breakdown
    const weakTopicStatusCounts = {
      needsRevision: weakRecords.filter((w) => w.status === 'NEEDS_REVISION').length,
      revising: weakRecords.filter((w) => w.status === 'REVISING').length,
      retested: weakRecords.filter((w) => w.status === 'RETESTED').length,
      resolved: weakRecords.filter((w) => w.status === 'RESOLVED').length,
      repeatedDifficulty: weakRecords.filter((w) => w.status === 'REPEATED_DIFFICULTY').length,
    }

    // D. Revision History Log
    const revisionHistory = revisionSessions.map((r) => ({
      id: r.id,
      weakTopicRecordId: r.weakTopicRecordId,
      documentId: r.documentId,
      documentName: documentNameMap.get(r.documentId) || 'Document',
      topicName: r.topicName,
      previousScore: r.previousScore,
      retestScore: r.retestScore,
      improvementDelta: r.improvementDelta,
      completedAt: r.completedAt || r.createdAt,
    }))

    // E. 7-Day Activity Trend
    const now = new Date()
    const activityTrend = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })

      const dayEvents = activityEvents.filter((e) => {
        const eDate = new Date(e.createdAt).toISOString().split('T')[0]
        return eDate === dateStr
      })
      const dayQuizzes = quizSessions.filter((q) => {
        const qDate = new Date(q.completedAt).toISOString().split('T')[0]
        return qDate === dateStr
      })
      const dayRevisions = revisionSessions.filter((r) => {
        const rDate = new Date(r.completedAt || r.createdAt).toISOString().split('T')[0]
        return rDate === dateStr
      })

      activityTrend.push({
        date: dateStr,
        label,
        reads: dayEvents.length,
        tests: dayQuizzes.length,
        revisions: dayRevisions.length,
        total: dayEvents.length + dayQuizzes.length + dayRevisions.length,
      })
    }

    // 6. Recent Learning Activity Feed
    let recentActivityFeed = activityEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      title: e.title,
      documentId: e.documentId,
      documentName: e.documentId ? documentNameMap.get(e.documentId) : null,
      createdAt: e.createdAt,
      details: e.details,
    }))

    // If activity events are sparse, synthesize grounded events from actual tests & uploads
    if (recentActivityFeed.length < 5) {
      const synthetic = []
      for (const q of quizSessions.slice(0, 5)) {
        synthetic.push({
          id: `quiz-evt-${q.id}`,
          eventType: 'TEST_COMPLETED',
          title: `Completed assessment with score ${q.scorePercentage}%`,
          documentId: q.documentId,
          documentName: documentNameMap.get(q.documentId) || 'Document',
          createdAt: q.completedAt,
          details: { score: q.scorePercentage, questions: q.totalQuestions },
        })
      }
      for (const r of revisionSessions.slice(0, 3)) {
        synthetic.push({
          id: `rev-evt-${r.id}`,
          eventType: 'REVISION_COMPLETED',
          title: `Retested weak topic "${r.topicName}" (Delta: ${r.improvementDelta >= 0 ? '+' : ''}${r.improvementDelta}%)`,
          documentId: r.documentId,
          documentName: documentNameMap.get(r.documentId) || 'Document',
          createdAt: r.completedAt || r.createdAt,
          details: { retestScore: r.retestScore, delta: r.improvementDelta },
        })
      }
      for (const d of documents.slice(0, 3)) {
        synthetic.push({
          id: `doc-evt-${d.id}`,
          eventType: 'DOCUMENT_UPLOADED',
          title: `Added "${d.fileName}" to personal library`,
          documentId: d.id,
          documentName: d.fileName,
          createdAt: d.uploadedAt,
          details: { size: d.fileSize },
        })
      }

      recentActivityFeed = [...recentActivityFeed, ...synthetic]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 15)
    }

    return {
      summary: {
        totalDocuments: totalDocs,
        documentsProcessing: docsProcessing,
        documentsReady: docsReady,
        documentsStudied: docsStudied,
        topicsCompleted: totalAllCompletedTopics,
        topicsRemaining: Math.max(0, totalAllTopics - totalAllCompletedTopics),
        topicsRevised: revisedTopicNames.size,
        weakTopics: totalWeakActive,
        overallLearningProgress: overallProgress,
        testPerformance: {
          totalTestsAttempted: totalTests,
          averageScore: avgTestScore,
          passRate,
          highestScore,
        },
      },
      documentProgress: documentProgressList,
      topicProgress: topicProgressItems,
      analytics: {
        testPerformance: testPerformanceChart,
        topicMasteryDistribution: {
          strong: strongTopicsCount,
          improving: improvingTopicsCount,
          weak: weakTopicsCount,
          unassessed: unassessedTopicsCount,
        },
        weakTopicsOverview: {
          counts: weakTopicStatusCounts,
          activeRecords: weakRecords.map((w) => ({
            id: w.id,
            documentId: w.documentId,
            documentName: documentNameMap.get(w.documentId) || 'Document',
            topicName: w.topicName,
            status: w.status,
            currentScore: w.currentScore,
            detectionReason: w.detectionReason,
            recommendation: w.recommendation,
            lastAssessedAt: w.lastAssessedAt,
          })),
        },
        revisionHistory,
        learningActivityOverTime: activityTrend,
      },
      recentActivity: recentActivityFeed,
      recentDocuments: documentProgressList.slice(0, 6),
    }
  }

  /**
   * Fetches detailed progress analytics for a single document
   */
  async function getDocumentAnalytics(userId, documentId) {
    if (!userId || !documentId) throw new HttpError(400, 'User and Document IDs are required.')

    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
    })
    if (!document) throw new HttpError(404, 'Document not found or does not belong to user.')

    const fullDashboard = await getDashboardAnalytics(userId)
    const docProgress = fullDashboard.documentProgress.find((d) => d.documentId === documentId)
    const docTopics = fullDashboard.topicProgress.filter((t) => t.documentId === documentId)
    const docWeak = fullDashboard.analytics.weakTopicsOverview.activeRecords.filter((w) => w.documentId === documentId)
    const docTests = fullDashboard.analytics.testPerformance.filter((t) => t.documentId === documentId)
    const docRevisions = fullDashboard.analytics.revisionHistory.filter((r) => r.documentId === documentId)

    return {
      document: {
        id: document.id,
        fileName: document.fileName,
        fileSize: document.fileSize,
        uploadStatus: document.uploadStatus,
        uploadedAt: document.uploadedAt,
      },
      progress: docProgress || null,
      topics: docTopics,
      weakTopics: docWeak,
      tests: docTests,
      revisions: docRevisions,
    }
  }

  return {
    recordActivityEvent,
    evaluateTopicCompletion,
    getDashboardAnalytics,
    getDocumentAnalytics,
  }
}
