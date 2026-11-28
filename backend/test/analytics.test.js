import assert from 'node:assert/strict'
import test from 'node:test'
import { createLearningAnalyticsService } from '../src/services/learning-analytics-service.js'

test('Learning analytics service calculates accurate metrics across documents, topics, and tests', async () => {
  const userId = 'user-analytics-1'
  const otherUserId = 'user-analytics-2'

  const mockDb = {
    document: {
      findMany: async ({ where }) => {
        if (where.userId === userId) {
          return [
            {
              id: 'doc-1',
              userId,
              fileName: 'Quantum_Computing.pdf',
              uploadStatus: 'ANALYSIS_COMPLETED',
              fileSize: 1024,
              uploadedAt: new Date(),
            },
            {
              id: 'doc-2',
              userId,
              fileName: 'Neural_Architectures.pdf',
              uploadStatus: 'PROCESSING',
              fileSize: 2048,
              uploadedAt: new Date(),
            },
          ]
        }
        return [
          {
            id: 'doc-other',
            userId: otherUserId,
            fileName: 'Secret_Document.pdf',
            uploadStatus: 'ANALYSIS_COMPLETED',
            fileSize: 512,
            uploadedAt: new Date(),
          },
        ]
      },
      findFirst: async ({ where }) => {
        if (where.userId === userId && where.id === 'doc-1') {
          return {
            id: 'doc-1',
            userId,
            fileName: 'Quantum_Computing.pdf',
            uploadStatus: 'ANALYSIS_COMPLETED',
            fileSize: 1024,
            uploadedAt: new Date(),
          }
        }
        return null
      },
    },
    topicLearningMaterial: {
      findMany: async ({ where }) => {
        if (where.userId === userId) {
          return [
            {
              id: 'mat-1',
              topicId: 'top-1',
              documentId: 'doc-1',
              userId,
              topicTitle: 'Qubits and Superposition',
              chapterTitle: 'Chapter 1',
              status: 'COMPLETED',
              lastGeneratedAt: new Date(),
            },
            {
              id: 'mat-2',
              topicId: 'top-2',
              documentId: 'doc-1',
              userId,
              topicTitle: 'Quantum Entanglement',
              chapterTitle: 'Chapter 1',
              status: 'IN_PROGRESS',
              lastGeneratedAt: new Date(),
            },
          ]
        }
        return []
      },
    },
    quizSession: {
      findMany: async ({ where }) => {
        if (where.userId === userId) {
          return [
            {
              id: 'quiz-1',
              userId,
              documentId: 'doc-1',
              scorePercentage: 85,
              totalQuestions: 5,
              correctCount: 4,
              completed: true,
              completedAt: new Date(),
              topicBreakdown: [
                { topicName: 'Qubits and Superposition', scorePercentage: 100 },
                { topicName: 'Quantum Entanglement', scorePercentage: 70 },
              ],
            },
            {
              id: 'quiz-2',
              userId,
              documentId: 'doc-1',
              scorePercentage: 40,
              totalQuestions: 5,
              correctCount: 2,
              completed: true,
              completedAt: new Date(),
              topicBreakdown: [
                { topicName: 'Quantum Entanglement', scorePercentage: 40 },
              ],
            },
          ]
        }
        return []
      },
    },
    weakTopicRecord: {
      findMany: async ({ where }) => {
        if (where.userId === userId) {
          return [
            {
              id: 'weak-1',
              userId,
              documentId: 'doc-1',
              topicName: 'Quantum Entanglement',
              status: 'NEEDS_REVISION',
              initialScore: 40,
              currentScore: 40,
              improvementDelta: 0.0,
              detectionReason: 'Scored 40% on assessment',
              recommendation: 'Review alternative analogy',
              lastAssessedAt: new Date(),
            },
          ]
        }
        return []
      },
    },
    topicRevisionSession: {
      findMany: async ({ where }) => {
        if (where.userId === userId) {
          return [
            {
              id: 'rev-1',
              weakTopicRecordId: 'weak-1',
              userId,
              documentId: 'doc-1',
              topicName: 'Quantum Entanglement',
              previousScore: 40,
              retestScore: 80,
              improvementDelta: 40.0,
              completed: true,
              completedAt: new Date(),
            },
          ]
        }
        return []
      },
    },
    learningActivityEvent: {
      events: [],
      create: async ({ data }) => {
        const item = { id: `evt-${Date.now()}`, ...data }
        mockDb.learningActivityEvent.events.push(item)
        return item
      },
      findMany: async ({ where }) => {
        return mockDb.learningActivityEvent.events.filter((e) => !where?.userId || e.userId === where.userId)
      },
    },
  }

  const service = createLearningAnalyticsService(mockDb)

  // 1. Test recordActivityEvent
  const loggedEvent = await service.recordActivityEvent(userId, {
    documentId: 'doc-1',
    topicId: 'top-1',
    eventType: 'TOPIC_STUDIED',
    title: 'Studying Qubits and Superposition',
    details: { timeSpentSeconds: 120 },
  })
  assert.ok(loggedEvent.id, 'Should create activity event')
  assert.equal(loggedEvent.eventType, 'TOPIC_STUDIED')

  // 2. Test getDashboardAnalytics
  const dashboard = await service.getDashboardAnalytics(userId)

  // Summary assertions
  assert.equal(dashboard.summary.totalDocuments, 2, 'Should count 2 user documents')
  assert.equal(dashboard.summary.documentsProcessing, 1, 'Should count 1 processing document')
  assert.equal(dashboard.summary.documentsReady, 1, 'Should count 1 ready document')
  assert.equal(dashboard.summary.documentsStudied, 1, 'Should count 1 studied document')
  assert.equal(dashboard.summary.topicsCompleted, 1, 'Should count 1 completed topic')
  assert.equal(dashboard.summary.weakTopics, 1, 'Should identify 1 active weak topic')
  assert.equal(dashboard.summary.topicsRevised, 1, 'Should identify 1 revised topic')

  // Test performance aggregation
  const testPerf = dashboard.summary.testPerformance
  assert.equal(testPerf.totalTestsAttempted, 2)
  assert.equal(testPerf.averageScore, 62.5, 'Average of 85 and 40 should be 62.5')
  assert.equal(testPerf.passRate, 50, '1 of 2 tests >= 60% = 50% pass rate')
  assert.equal(testPerf.highestScore, 85)

  // Document progress assertions
  assert.equal(dashboard.documentProgress.length, 2)
  const doc1Progress = dashboard.documentProgress.find((d) => d.documentId === 'doc-1')
  assert.equal(doc1Progress.documentName, 'Quantum_Computing.pdf')
  assert.equal(doc1Progress.topicsCompleted, 1)
  assert.equal(doc1Progress.testsAttempted, 2)
  assert.equal(doc1Progress.score, 62.5)
  assert.equal(doc1Progress.weakTopics, 1)

  // Topic progress transparent completion criteria assertions
  assert.equal(dashboard.topicProgress.length, 2)
  const qubitTopic = dashboard.topicProgress.find((t) => t.topicTitle === 'Qubits and Superposition')
  assert.equal(qubitTopic.status, 'COMPLETED')
  assert.ok(qubitTopic.completionCriteria.includes('Marked completed'))

  // Analytics charts assertions
  assert.equal(dashboard.analytics.testPerformance.length, 2)
  assert.equal(dashboard.analytics.revisionHistory.length, 1)
  assert.equal(dashboard.analytics.revisionHistory[0].improvementDelta, 40.0)
  assert.equal(dashboard.analytics.learningActivityOverTime.length, 7, 'Should produce 7-day trend')

  // User isolation: other user's documents must not appear
  assert.ok(!dashboard.documentProgress.some((d) => d.documentName === 'Secret_Document.pdf'))
})
