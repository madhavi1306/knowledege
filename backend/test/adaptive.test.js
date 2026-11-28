import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAdaptiveLearningService,
  synthesizeAdaptiveReteach,
} from '../src/services/adaptive-learning-service.js'

test('synthesizeAdaptiveReteach produces different explanations, simpler words, micro-steps, and practice checks', () => {
  const reteach = synthesizeAdaptiveReteach({
    topicName: 'Heuristic Search Optimization',
    material: {
      topicTitle: 'Heuristic Search Optimization',
      simpleDefinition: 'A search technique using problem-specific knowledge to find goals faster.',
      pageReferences: [2],
    },
    page: { pageNumber: 2 },
    incorrectHistory: [
      {
        questionText: 'What is the role of heuristic evaluation f(n)?',
        userAnswer: 'It randomizes the search path',
        correctAnswer: 'It estimates the lowest cost to the goal',
      },
    ],
  })

  // 1. Gap Analysis
  assert.ok(reteach.gapAnalysis.includes('Misconception Identified'), 'Should identify student error')

  // 2. Simpler Words
  assert.ok(reteach.simplifiedExplanation.includes('everyday words'), 'Should explain in simpler words')

  // 3. Smaller Micro-Steps
  assert.equal(reteach.microSteps.length, 3, 'Should have 3 micro-steps')
  assert.ok(reteach.microSteps[0].title)

  // 4. Distinct Alternative Analogy
  assert.ok(reteach.differentAnalogy.title.includes('Train Station Signal Controller'), 'Should provide new analogy')

  // 5. Simplified Diagram
  assert.ok(reteach.simplifiedDiagram.includes('graph TD'), 'Should provide Mermaid diagram')

  // 6. Practice Questions
  assert.equal(reteach.practiceQuestions.length, 2, 'Should provide targeted practice checks')
})

test('Adaptive learning service detects weak topics from real test scores, generates reteach, and evaluates retest with improvement delta', async () => {
  const mockDb = {
    sessions: [
      {
        id: 'sess-1',
        userId: 'u-1',
        documentId: 'doc-1',
        completed: true,
        createdAt: new Date(),
      },
    ],
    questions: [
      // 3 questions on Topic A: 1 correct, 2 incorrect -> 33.3% accuracy (WEAK!)
      {
        id: 'q-1',
        quizSessionId: 'sess-1',
        topicName: 'Markov Decision Processes',
        questionText: 'What does the transition probability P(s, a, s) represent?',
        isCorrect: false,
        userAnswer: 'Static memory size',
        correctAnswer: 'Probability of reaching state s given action a from state s',
        explanation: 'Transition dynamics govern stochastic state transitions.',
        pageNumber: 3,
      },
      {
        id: 'q-2',
        quizSessionId: 'sess-1',
        topicName: 'Markov Decision Processes',
        questionText: 'True or False: Bellman optimality equation is non-linear.',
        isCorrect: false,
        userAnswer: 'False',
        correctAnswer: 'True',
        explanation: 'The max operator over actions introduces non-linearity.',
        pageNumber: 3,
      },
      {
        id: 'q-3',
        quizSessionId: 'sess-1',
        topicName: 'Markov Decision Processes',
        questionText: 'What is the discount factor gamma used for?',
        isCorrect: true,
        userAnswer: 'Weighting future rewards',
        correctAnswer: 'Weighting future rewards',
        explanation: 'Discount factor bounds infinite horizon returns.',
        pageNumber: 3,
      },
      // 2 questions on Topic B: 2 correct -> 100% accuracy (STRONG, not weak!)
      {
        id: 'q-4',
        quizSessionId: 'sess-1',
        topicName: 'Gradient Descent',
        questionText: 'What does the learning rate control?',
        isCorrect: true,
        userAnswer: 'Step size',
        correctAnswer: 'Step size',
        explanation: 'Controls step size along negative gradient.',
        pageNumber: 1,
      },
      {
        id: 'q-5',
        quizSessionId: 'sess-1',
        topicName: 'Gradient Descent',
        questionText: 'What is stochastic gradient descent?',
        isCorrect: true,
        userAnswer: 'Mini-batch approximation',
        correctAnswer: 'Mini-batch approximation',
        explanation: 'Computes gradient over subset of training instances.',
        pageNumber: 1,
      },
    ],
    weakTopics: [],
    revisionSessions: [],
    documents: [{ id: 'doc-1', userId: 'u-1', fileName: 'AI_Course.pdf' }],
    materials: [
      {
        topicTitle: 'Markov Decision Processes',
        simpleDefinition: 'A formal framework for modeling decision making under uncertainty.',
        pageReferences: [3],
      },
    ],
    pages: [{ pageNumber: 3, section: 'Reinforcement Learning' }],

    quizSession: {
      findMany: async ({ where }) => mockDb.sessions.filter((s) => s.userId === where.userId && s.completed === where.completed),
    },
    quizQuestion: {
      findMany: async () => mockDb.questions,
    },
    document: {
      findUnique: async ({ where }) => mockDb.documents.find((d) => d.id === where.id) || null,
    },
    topicLearningMaterial: {
      findMany: async () => mockDb.materials,
    },
    extractedPage: {
      findMany: async () => mockDb.pages,
    },
    weakTopicRecord: {
      upsert: async ({ where, create, update }) => {
        let rec = mockDb.weakTopics.find((w) => w.topicName === where.userId_documentId_topicName.topicName)
        if (!rec) {
          rec = { id: `weak-${mockDb.weakTopics.length + 1}`, ...create }
          mockDb.weakTopics.push(rec)
        } else {
          Object.assign(rec, update)
        }
        return rec
      },
      findUnique: async ({ where }) => mockDb.weakTopics.find((w) => w.id === where.id) || null,
      findFirst: async ({ where }) => mockDb.weakTopics.find((w) => w.topicName === where.topicName) || null,
      findMany: async ({ where }) => mockDb.weakTopics.filter((w) => w.userId === where.userId),
      update: async ({ where, data }) => {
        const rec = mockDb.weakTopics.find((w) => w.id === where.id)
        if (rec) Object.assign(rec, data)
        return rec
      },
    },
    topicRevisionSession: {
      create: async ({ data }) => {
        const sess = { id: `rev-sess-${mockDb.revisionSessions.length + 1}`, ...data }
        mockDb.revisionSessions.push(sess)
        return sess
      },
      findUnique: async ({ where }) => mockDb.revisionSessions.find((s) => s.id === where.id) || null,
      update: async ({ where, data }) => {
        const sess = mockDb.revisionSessions.find((s) => s.id === where.id)
        if (sess) Object.assign(sess, data)
        return sess
      },
    },
  }

  const adaptiveService = createAdaptiveLearningService(mockDb)

  // 1. Detect weak topics
  const detection = await adaptiveService.detectAndSyncWeakTopics('u-1', 'doc-1')
  assert.equal(detection.weakTopics.length, 1, 'Only Topic A (33.3%) should be detected as weak; Topic B (100%) is strong')
  assert.equal(detection.weakTopics[0].topicName, 'Markov Decision Processes')
  assert.equal(detection.weakTopics[0].status, 'NEEDS_REVISION')
  assert.ok(detection.weakTopics[0].detectionReason.includes('33.3%'))
  assert.equal(detection.weakTopics[0].incorrectAnswersHistory.length, 2, 'Should capture the 2 failed questions')

  // 2. Generate Adaptive Reteach
  const reteachRes = await adaptiveService.getOrGenerateAdaptiveReteach('u-1', detection.weakTopics[0].id)
  assert.equal(reteachRes.record.status, 'REVISING')
  assert.ok(reteachRes.adaptiveReteach.differentAnalogy)
  assert.equal(reteachRes.adaptiveReteach.microSteps.length, 3)

  // 3. Generate Retest with new questions
  const retestGen = await adaptiveService.generateRetest('u-1', detection.weakTopics[0].id)
  assert.equal(retestGen.session.retestQuestions.length, 4)
  // Ensure answers are hidden in the response
  for (const q of retestGen.session.retestQuestions) {
    assert.equal(q.correctAnswer, undefined, 'Retest correct answers must be hidden before submission')
  }

  // 4. Submit Retest with all 4 correct answers
  const storedSession = mockDb.revisionSessions[0]
  const answers = {}
  for (const q of storedSession.retestQuestions) {
    answers[q.id] = q.correctAnswer
  }

  const retestResult = await adaptiveService.submitRetest({
    userId: 'u-1',
    sessionId: retestGen.session.id,
    answers,
  })

  // 5. Verify score comparison and status change
  assert.equal(retestResult.results.previousScore, 33.3)
  assert.equal(retestResult.results.retestScore, 100)
  assert.equal(retestResult.results.improvementDelta, 66.7, 'Demonstrates +66.7% improvement delta')
  assert.equal(retestResult.results.status, 'RESOLVED', 'Weak topic successfully resolved!')
  assert.equal(retestResult.weakTopicRecord.status, 'RESOLVED')
})
