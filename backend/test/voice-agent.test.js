import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createVoiceAgentService } from '../src/services/voice-agent-service.js'

function createPrisma(concepts = []) {
  return {
    concept: {
      async findMany({ where }) {
        return concepts.filter((concept) => (
          concept.userId === where.userId &&
          (!where.sources || concept.sources.some((source) => source.documentId === where.sources.some.documentId))
        ))
      },
    },
  }
}

test('voice answers use the configured model and the signed-in learner document context', async () => {
  const previous = {
    key: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
  }
  process.env.OPENAI_API_KEY = 'test-voice-key'
  process.env.OPENAI_MODEL = 'test-voice-model'
  let request
  const service = createVoiceAgentService(createPrisma([{
    id: 'concept-1',
    userId: 'user-1',
    name: 'Cellular respiration',
    definition: 'Cells convert glucose into usable energy.',
    detailedExplanation: 'The process transfers energy into ATP.',
    simpleExplanation: 'Cells turn food into energy they can use.',
    examples: ['Muscle cells use ATP.'],
    mastery: { status: 'LEARNING' },
    sources: [{ documentId: 'document-1', pageNumber: 4, excerpt: 'Cells convert glucose into usable energy.' }],
  }]), {
    fetchImpl: async (_url, options) => {
      request = options
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ reply: 'Cells turn food into usable energy.' }) } }] }),
      }
    },
  })

  try {
    const result = await service.chatWithVoiceAgent('user-1', {
      message: 'Explain this in simple words',
      context: { pathname: '/app/papers/document-1/learn', documentId: 'document-1' },
    })
    assert.equal(result.reply, 'Cells turn food into usable energy.')
    assert.equal(result.action, null)
    assert.equal(request.headers.Authorization, 'Bearer test-voice-key')
    const prompt = JSON.parse(JSON.parse(request.body).messages[1].content)
    assert.equal(prompt.documentId, 'document-1')
    assert.equal(prompt.concepts[0].name, 'Cellular respiration')
  } finally {
    if (previous.key === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous.key
    if (previous.model === undefined) delete process.env.OPENAI_MODEL
    else process.env.OPENAI_MODEL = previous.model
  }
})

test('voice reports missing AI configuration instead of returning a fabricated answer', async () => {
  const previous = {
    key: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
  }
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_MODEL
  const service = createVoiceAgentService(createPrisma())

  try {
    await assert.rejects(
      service.chatWithVoiceAgent('user-1', { message: 'Explain photosynthesis' }),
      (error) => error.status === 503 && /OPENAI_API_KEY/.test(error.message),
    )
  } finally {
    if (previous.key !== undefined) process.env.OPENAI_API_KEY = previous.key
    if (previous.model !== undefined) process.env.OPENAI_MODEL = previous.model
  }
})

test('voice reports weak topics only from persisted mastery records', async () => {
  const service = createVoiceAgentService(createPrisma([
    { id: 'weak-1', userId: 'user-1', name: 'Photosynthesis', mastery: { status: 'WEAK' }, sources: [] },
    { id: 'mastered-1', userId: 'user-1', name: 'Cell structure', mastery: { status: 'MASTERED' }, sources: [] },
  ]))

  const result = await service.chatWithVoiceAgent('user-1', { message: 'What topics am I weak in?' })
  assert.equal(result.reply, 'Topics marked for review: Photosynthesis.')
  assert.equal(result.action, null)
})

test('voice assistant supports natural conversational greetings without needing AI credentials', async () => {
  const service = createVoiceAgentService(createPrisma())
  const result = await service.chatWithVoiceAgent('user-1', { message: 'Hi' })
  assert.ok(result.reply.includes('Hi! How can I help you today?'))
  assert.equal(result.action, null)
})

test('voice assistant executes real application navigation commands', async () => {
  const service = createVoiceAgentService(createPrisma())

  // Open documents
  const docRes = await service.chatWithVoiceAgent('user-1', { message: 'Open my documents' })
  assert.equal(docRes.reply, 'Sure, opening your document library.')
  assert.equal(docRes.action.type, 'NAVIGATE')
  assert.equal(docRes.action.path, '/app/papers')

  // Open dashboard
  const dashRes = await service.chatWithVoiceAgent('user-1', { message: 'Open dashboard' })
  assert.equal(dashRes.reply, 'Sure, opening your learning dashboard.')
  assert.equal(dashRes.action.type, 'NAVIGATE')
  assert.equal(dashRes.action.path, '/app')

  // Start test
  const testRes = await service.chatWithVoiceAgent('user-1', {
    message: 'Give me a test',
    context: { documentId: 'doc-xyz' },
  })
  assert.equal(testRes.reply, "Sure. Let's test what you learned.")
  assert.equal(testRes.action.type, 'NAVIGATE')
  assert.equal(testRes.action.path, '/app/papers/doc-xyz/test')

  // Open weak topics
  const weakRes = await service.chatWithVoiceAgent('user-1', {
    message: 'Open weak topics',
    context: { documentId: 'doc-xyz' },
  })
  assert.equal(weakRes.reply, 'Sure, opening your weak topics and adaptive revision.')
  assert.equal(weakRes.action.type, 'NAVIGATE')
  assert.equal(weakRes.action.path, '/app/papers/doc-xyz/adaptive')
})

test('voice assistant opens ordinal documents and simplifies explanations', async () => {
  const mockPrisma = {
    concept: {
      findMany: async () => [],
    },
    document: {
      findMany: async () => [
        { id: 'doc-1', fileName: 'Astrophysics.pdf', uploadedAt: new Date() },
        { id: 'doc-2', fileName: 'Quantum_Mechanics.pdf', uploadedAt: new Date() },
      ],
    },
    topicLearningMaterial: {
      findMany: async () => [
        {
          id: 'mat-1',
          topicTitle: 'Wave-Particle Duality',
          simpleDefinition: 'Light and matter exhibit behaviors of both waves and particles.',
          easyExplanation: 'Depending on the measurement setup, photons behave like waves or tiny bullets.',
          realWorldExample: 'Imagine tossing pebbles into a pond: each creates concentric ripples.',
        },
      ],
    },
  }

  const service = createVoiceAgentService(mockPrisma)

  // 1. Ordinal document opening
  const ordinalRes = await service.chatWithVoiceAgent('user-1', { message: 'Open my second PDF' })
  assert.ok(ordinalRes.reply.includes('Quantum_Mechanics.pdf'))
  assert.equal(ordinalRes.action.type, 'NAVIGATE')
  assert.equal(ordinalRes.action.path, '/app/papers/doc-2/learn')

  // 2. Ordinal topic explanation
  const explainRes = await service.chatWithVoiceAgent('user-1', {
    message: 'Explain the first topic',
    context: { documentId: 'doc-2' },
  })
  assert.ok(explainRes.reply.includes('Wave-Particle Duality'))
  assert.ok(explainRes.reply.includes('simple words'))

  // 3. "I don't understand" follow-up
  const simplerRes = await service.chatWithVoiceAgent('user-1', {
    message: "I don't understand",
    context: { documentId: 'doc-2' },
  })
  assert.ok(simplerRes.reply.includes('easier example'))
  assert.ok(simplerRes.reply.includes('pebbles into a pond'))
})
