import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { buildDocumentChunks, retrieveRelevantChunks } from '../src/services/retrieval-engine.js'
import { createChatService, synthesizeDocumentAnswer } from '../src/services/chat-service.js'

test('buildDocumentChunks and retrieveRelevantChunks retrieve high-precision document chunks', () => {
  const documentId = 'test-doc-1'
  const pages = [
    {
      pageNumber: 1,
      section: 'Introduction to Deep Learning',
      headings: ['Introduction to Deep Learning', 'Neural Network Foundations'],
      paragraphs: [
        'Artificial neural networks are computational models inspired by biological neural systems.',
        'They consist of an input layer, hidden layers, and an output layer connected by synaptic weights.',
      ],
      definitions: [{ term: 'Perceptron', definition: 'A single-layer neural network unit.' }],
      tables: ['Layer | Activation\nHidden | ReLU\nOutput | Softmax'],
    },
    {
      pageNumber: 2,
      section: 'Optimization Algorithms',
      headings: ['Optimization Algorithms', 'Gradient Descent and Backpropagation'],
      paragraphs: [
        'Backpropagation computes the gradient of the loss function with respect to each weight by the chain rule.',
        'Stochastic gradient descent updates parameters using mini-batches.',
      ],
    },
  ]

  const visuals = [
    {
      id: 'vis-1',
      title: 'Neural Network Architecture Diagram',
      type: 'DIAGRAM',
      pageNumber: 1,
      whatItRepresents: 'Flow of features from input nodes through dense hidden layers to softmax output.',
      purpose: 'Visualizes feedforward propagation.',
      partsExplanation: [{ name: 'Input Layer', description: 'Receives raw features' }],
      arrowsExplanation: 'Input -> Hidden -> Output: Feedforward signal propagation',
      stepByStepProcess: ['Input features are normalized', 'Linear combination with weights', 'Activation applied'],
      easyExample: 'Like an assembly line where each station processes and refines the item.',
    },
  ]

  const materials = [
    {
      topicTitle: 'Neural Network Foundations',
      chapterTitle: 'Introduction to Deep Learning',
      simpleDefinition: 'A computer system designed to recognize patterns like the human brain.',
      easyExplanation: 'It learns from examples rather than being explicitly programmed.',
      pageReferences: [1],
    },
  ]

  const chunks = buildDocumentChunks({ documentId, pages, visuals, materials })
  assert.ok(chunks.length >= 4, 'Should build text, table, definition, visual, and topic chunks')

  // Test 1: Question from document (Backpropagation on Page 2)
  const q1 = retrieveRelevantChunks('How does backpropagation compute gradients?', chunks)
  assert.equal(q1.isOutOfScope, false)
  assert.ok(q1.chunks.length > 0)
  assert.equal(q1.chunks[0].pageNumber, 2)
  assert.ok(q1.chunks[0].content.includes('chain rule'))

  // Test 2: Diagram question
  const q2 = retrieveRelevantChunks('Explain the architecture diagram and arrows', chunks)
  assert.equal(q2.isOutOfScope, false)
  assert.equal(q2.chunks[0].type, 'VISUAL')
  assert.equal(q2.chunks[0].pageNumber, 1)

  // Test 3: Table question
  const q3 = retrieveRelevantChunks('What activation functions are shown in the layer table?', chunks)
  assert.equal(q3.isOutOfScope, false)
  assert.equal(q3.chunks[0].type, 'TABLE')

  // Test 4: Difficult word / Definition question
  const q4 = retrieveRelevantChunks('What is the definition of a perceptron?', chunks)
  assert.equal(q4.isOutOfScope, false)
  assert.ok(q4.chunks[0].content.includes('Perceptron'))

  // Test 5: Out of document scope query
  const q5 = retrieveRelevantChunks('What is the recipe for baking chocolate chip cookies in Paris?', chunks)
  assert.equal(q5.isOutOfScope, true)
})

test('synthesizeDocumentAnswer provides all 5 required elements and handles out-of-scope gracefully', () => {
  const document = {
    id: 'doc-alpha',
    fileName: 'Deep_Learning_Basics.pdf',
    analysis: { subject: 'Machine Learning' },
  }

  const sampleChunks = [
    {
      id: 'chunk-1',
      pageNumber: 3,
      section: 'Transformer Self-Attention',
      title: 'Scaled Dot-Product Attention',
      type: 'TEXT',
      content: 'Scaled dot-product attention computes query-key dot products divided by sqrt(d_k), followed by softmax.',
      excerpt: 'Scaled dot-product attention computes query-key dot products...',
    },
  ]

  // Test document-grounded synthesis
  const answer = synthesizeDocumentAnswer({
    question: 'How does scaled dot-product attention work?',
    document,
    retrievedChunks: sampleChunks,
    isOutOfScope: false,
    queryIntent: { isStepQuery: true },
  })

  assert.ok(answer.directAnswer.includes('Page 3'), 'Direct answer should cite Page 3')
  assert.ok(answer.simpleExplanation.length > 20, 'Simple explanation in easy English')
  assert.ok(answer.example.length > 20, 'Example provided')
  assert.ok(answer.importantPoints.length >= 2, 'Important points list present')
  assert.deepEqual(answer.pageReferences, [3], 'Accurate page reference')
  assert.equal(answer.notCovered, false)

  // Test out-of-scope question
  const outOfScopeAnswer = synthesizeDocumentAnswer({
    question: 'What is the stock price of Apple today?',
    document,
    retrievedChunks: [],
    isOutOfScope: true,
  })

  assert.equal(outOfScopeAnswer.notCovered, true)
  assert.ok(outOfScopeAnswer.directAnswer.includes('not covered in your uploaded document'))
  assert.deepEqual(outOfScopeAnswer.pageReferences, [])
})

test('Chat service and HTTP API routes support multi-turn conversation and persistence', async () => {
  const mockDb = {
    sessions: [],
    messages: [],
    documents: [
      {
        id: 'doc-123',
        userId: 'user-abc',
        fileName: 'Quantum_Computing.pdf',
        analysis: { subject: 'Quantum Physics' },
      },
    ],
    pages: [
      {
        id: 'p-1',
        documentId: 'doc-123',
        pageNumber: 1,
        section: 'Qubits and Superposition',
        headings: ['Qubits and Superposition'],
        paragraphs: [
          'A qubit can exist in a superposition of states |0> and |1>.',
          'Bloch sphere provides a geometric representation of pure qubit states.',
        ],
        definitions: [{ term: 'Qubit', definition: 'The basic unit of quantum information.' }],
      },
      {
        id: 'p-2',
        documentId: 'doc-123',
        pageNumber: 2,
        section: 'Quantum Entanglement',
        headings: ['Quantum Entanglement and Bell States'],
        paragraphs: [
          'Entangled pairs exhibit correlations that cannot be explained by classical physics.',
          'Bell measurement projects two qubits into maximally entangled Bell states.',
        ],
      },
    ],
    document: {
      findUnique: async ({ where }) => mockDb.documents.find((d) => d.id === where.id) || null,
    },
    extractedPage: {
      findMany: async ({ where }) => mockDb.pages.filter((p) => p.documentId === where.documentId),
    },
    documentVisual: {
      findMany: async () => [],
    },
    topicLearningMaterial: {
      findMany: async () => [],
    },
    concept: {
      findMany: async () => [],
    },
    documentChatSession: {
      findFirst: async ({ where }) => mockDb.sessions.find((s) => s.documentId === where.documentId) || null,
      findUnique: async ({ where, include }) => {
        const s = mockDb.sessions.find((s) => s.id === where.id)
        if (!s) return null
        if (include?.messages) {
          return { ...s, messages: mockDb.messages.filter((m) => m.sessionId === s.id) }
        }
        return s
      },
      findMany: async ({ where }) => mockDb.sessions.filter((s) => s.documentId === where.documentId),
      create: async ({ data }) => {
        const session = { id: 'session-1', ...data, createdAt: new Date(), updatedAt: new Date() }
        mockDb.sessions.push(session)
        return session
      },
      update: async ({ where, data }) => {
        const s = mockDb.sessions.find((s) => s.id === where.id)
        if (s) Object.assign(s, data, { updatedAt: new Date() })
        return s
      },
    },
    documentChatMessage: {
      create: async ({ data }) => {
        const msg = { id: `msg-${mockDb.messages.length + 1}`, ...data, createdAt: new Date() }
        mockDb.messages.push(msg)
        return msg
      },
      findMany: async ({ where }) => mockDb.messages.filter((m) => m.sessionId === where.sessionId),
      deleteMany: async ({ where }) => {
        mockDb.messages = mockDb.messages.filter((m) => m.sessionId !== where.sessionId)
        return { count: 1 }
      },
    },
  }

  const chatService = createChatService(mockDb)

  // 1. Ask initial question about Chapter 1
  const turn1 = await chatService.answerQuestion({
    userId: 'user-abc',
    documentId: 'doc-123',
    question: 'What is a qubit according to the document?',
  })

  assert.equal(turn1.userMessage.content, 'What is a qubit according to the document?')
  assert.equal(turn1.assistantMessage.role, 'assistant')
  assert.ok(turn1.assistantMessage.directAnswer.includes('Page 1'))
  assert.deepEqual(turn1.assistantMessage.pageReferences, [1])

  // 2. Ask follow-up question
  const turn2 = await chatService.answerQuestion({
    userId: 'user-abc',
    documentId: 'doc-123',
    sessionId: turn1.session.id,
    question: 'Can you explain that more simply in easy English?',
  })

  assert.ok(turn2.assistantMessage.simpleExplanation.includes('simple words'))
  assert.equal(mockDb.messages.length, 4, 'Should have 2 user messages and 2 assistant messages persisted')

  // 3. Clear session
  const cleared = await chatService.clearSession('user-abc', turn1.session.id)
  assert.equal(cleared.cleared, true)
  assert.equal(mockDb.messages.length, 0, 'Messages should be cleared')
})
