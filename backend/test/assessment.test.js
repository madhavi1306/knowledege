import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAssessmentService,
  evaluateQuestionAnswer,
  synthesizeQuestionsFromContent,
} from '../src/services/assessment-service.js'

test('synthesizeQuestionsFromContent generates questions for all 5 required types grounded in document content', () => {
  const document = { id: 'doc-ai', fileName: 'Artificial_Intelligence.pdf' }
  const pages = [
    {
      pageNumber: 1,
      section: 'Search Algorithms',
      headings: ['Search Algorithms', 'Informed Heuristic Search'],
      paragraphs: ['A-star search uses heuristic evaluation f(n) = g(n) + h(n) to find the shortest path.'],
    },
    {
      pageNumber: 2,
      section: 'Reinforcement Learning',
      headings: ['Reinforcement Learning', 'Markov Decision Processes'],
      paragraphs: ['Bellman equation expresses the value of a state recursively in terms of expected future rewards.'],
    },
  ]

  const materials = [
    {
      topicTitle: 'Informed Heuristic Search',
      chapterTitle: 'Search Algorithms',
      simpleDefinition: 'A search technique using problem-specific knowledge to find goals faster.',
      easyExplanation: 'It looks ahead to guess which direction is most promising.',
      pageReferences: [1],
    },
  ]

  const visuals = [
    {
      title: 'A-star Tree Search Visual',
      type: 'DIAGRAM',
      pageNumber: 1,
      whatItRepresents: 'Node expansion tree showing open list and closed list evaluation.',
      purpose: 'Visualizes optimal path selection.',
    },
  ]

  const questions = synthesizeQuestionsFromContent({
    document,
    pages,
    materials,
    visuals,
    scope: 'DOCUMENT',
    difficulty: 'MEDIUM',
    targetCount: 5,
  })

  assert.equal(questions.length, 5)

  const types = new Set(questions.map((q) => q.type))
  assert.ok(types.has('MULTIPLE_CHOICE'), 'Should have MULTIPLE_CHOICE')
  assert.ok(types.has('TRUE_FALSE'), 'Should have TRUE_FALSE')
  assert.ok(types.has('FILL_IN_BLANKS'), 'Should have FILL_IN_BLANKS')
  assert.ok(types.has('SHORT_ANSWER'), 'Should have SHORT_ANSWER')
  assert.ok(types.has('CONCEPT_BASED'), 'Should have CONCEPT_BASED')

  for (const q of questions) {
    assert.ok(q.questionText.length > 10, 'Question text present')
    assert.ok(q.correctAnswer, 'Correct answer defined')
    assert.ok(q.explanation.length > 10, 'Explanation present')
    assert.ok(q.pageNumber >= 1, 'Valid document page reference')
  }
})

test('evaluateQuestionAnswer properly grades multiple choice, true/false, fill in blanks, and short answers', () => {
  // 1. Multiple Choice
  const mcq = { type: 'MULTIPLE_CHOICE', correctAnswer: 'A) Supervised Learning' }
  assert.equal(evaluateQuestionAnswer(mcq, 'A) Supervised Learning'), true)
  assert.equal(evaluateQuestionAnswer(mcq, 'a'), true)
  assert.equal(evaluateQuestionAnswer(mcq, 'B) Unsupervised'), false)

  // 2. True / False
  const tf = { type: 'TRUE_FALSE', correctAnswer: 'True' }
  assert.equal(evaluateQuestionAnswer(tf, 'True'), true)
  assert.equal(evaluateQuestionAnswer(tf, 'true'), true)
  assert.equal(evaluateQuestionAnswer(tf, 'False'), false)

  // 3. Fill in Blanks
  const fib = { type: 'FILL_IN_BLANKS', correctAnswer: 'Heuristic' }
  assert.equal(evaluateQuestionAnswer(fib, 'Heuristic'), true)
  assert.equal(evaluateQuestionAnswer(fib, 'heuristic'), true)
  assert.equal(evaluateQuestionAnswer(fib, 'random'), false)

  // 4. Short answer semantic keyword matching
  const sa = {
    type: 'SHORT_ANSWER',
    correctAnswer: 'Bellman equation expresses recursive state values through future rewards',
  }
  assert.equal(evaluateQuestionAnswer(sa, 'It expresses state values recursively with future rewards'), true)
  assert.equal(evaluateQuestionAnswer(sa, 'Complete gibberish unrelated to the question'), false)
})

test('Assessment service generates, hides answers before submission, evaluates scores, and persists history', async () => {
  const mockDb = {
    sessions: [],
    questions: [],
    documents: [{ id: 'doc-1', userId: 'user-1', fileName: 'AI_Textbook.pdf' }],
    materials: [
      {
        id: 'mat-1',
        topicId: 'topic-1',
        topicTitle: 'Neural Networks',
        chapterTitle: 'Deep Learning',
        simpleDefinition: 'Computing systems inspired by biological neural networks.',
        pageReferences: [1],
      },
      {
        id: 'mat-2',
        topicId: 'topic-2',
        topicTitle: 'Convolutional Filters',
        chapterTitle: 'Computer Vision',
        simpleDefinition: 'Mathematical operations applied to spatial image features.',
        pageReferences: [2],
      },
    ],
    pages: [
      {
        id: 'p-1',
        documentId: 'doc-1',
        pageNumber: 1,
        section: 'Deep Learning',
        paragraphs: ['Neural networks utilize activation functions to introduce non-linearity.'],
      },
    ],
    document: {
      findUnique: async ({ where }) => mockDb.documents.find((d) => d.id === where.id) || null,
    },
    topicLearningMaterial: {
      findMany: async ({ where }) => mockDb.materials,
    },
    extractedPage: {
      findMany: async ({ where }) => mockDb.pages,
    },
    documentVisual: {
      findMany: async () => [],
    },
    documentAnalysis: {
      findUnique: async () => null,
    },
    quizSession: {
      create: async ({ data }) => {
        const id = 'sess-test-1'
        const rawQs = data.questions?.create || []
        const createdQuestions = rawQs.map((q, idx) => ({
          id: `q-${idx + 1}`,
          quizSessionId: id,
          ...q,
        }))
        mockDb.questions.push(...createdQuestions)

        const sess = {
          id,
          ...data,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        mockDb.sessions.push(sess)
        return sess
      },
      findUnique: async ({ where }) => mockDb.sessions.find((s) => s.id === where.id) || null,
      findMany: async ({ where }) => mockDb.sessions.filter((s) => s.userId === where.userId),
      update: async ({ where, data }) => {
        const s = mockDb.sessions.find((s) => s.id === where.id)
        if (s) Object.assign(s, data, { updatedAt: new Date() })
        return s
      },
    },
    quizQuestion: {
      findMany: async ({ where }) => mockDb.questions.filter((q) => q.quizSessionId === where.quizSessionId),
      update: async ({ where, data }) => {
        const q = mockDb.questions.find((q) => q.id === where.id)
        if (q) Object.assign(q, data)
        return q
      },
    },
  }

  const assessmentService = createAssessmentService(mockDb)

  // 1. Generate a 5-question Topic Test
  const testGen = await assessmentService.generateTest({
    userId: 'user-1',
    documentId: 'doc-1',
    scope: 'TOPIC',
    topicId: 'topic-1',
    difficulty: 'MEDIUM',
    questionCount: 5,
  })

  assert.equal(testGen.session.totalQuestions, 5)
  assert.equal(testGen.session.completed, false)
  // Ensure correct answers are hidden before submission
  for (const q of testGen.session.questions) {
    assert.equal(q.correctAnswer, undefined, 'Correct answers must remain hidden from students before submission!')
    assert.equal(q.explanation, undefined, 'Explanations must remain hidden before submission!')
  }

  // 2. Submit test with answers
  const storedQuestions = mockDb.questions
  const userAnswers = {}
  // Provide correct answer for first 4, wrong for 5th
  for (let i = 0; i < storedQuestions.length; i++) {
    const q = storedQuestions[i]
    userAnswers[q.id] = i < 4 ? q.correctAnswer : 'Completely incorrect test response'
  }

  const submission = await assessmentService.submitTest({
    userId: 'user-1',
    sessionId: testGen.session.id,
    answers: userAnswers,
  })

  assert.equal(submission.session.completed, true)
  assert.equal(submission.results.correctCount, 4)
  assert.equal(submission.results.incorrectCount, 1)
  assert.equal(submission.results.scorePercentage, 80)
  assert.ok(submission.results.topicPerformance.length > 0)

  // Now, answers and explanations should be revealed in the result
  const evaluatedQuestions = submission.session.questions
  assert.ok(evaluatedQuestions[0].correctAnswer, 'Correct answer revealed after submission')
  assert.ok(evaluatedQuestions[0].explanation, 'Explanation revealed after submission')

  // 3. Test History retrieval
  const history = await assessmentService.getTestHistory('user-1', 'doc-1')
  assert.equal(history.history.length, 1)
  assert.equal(history.history[0].scorePercentage, 80)
  assert.equal(history.history[0].totalQuestions, 5)
})
