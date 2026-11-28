import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'
import { textToPdfBuffer, extractTextFromHtml } from '../src/utils/material-converter.js'
import { calculateFsrsNextState } from '../src/services/spaced-repetition-service.js'
import { signSession } from '../src/utils/token.js'

process.env.JWT_SECRET = 'test-only-secret-for-knowflow-full-suite'
process.env.NODE_ENV = 'test'

let server
let baseUrl
let users
let documents
let concepts
let conceptRelationships
let conceptMastery
let quizSessions
let quizQuestions
let recoverySessions
let recoverySteps
let spacedReviews

function createFullMockPrisma() {
  return {
    user: {
      async findUnique({ where }) {
        if (where.id) return users.get(where.id) ?? null
        return [...users.values()].find((u) => u.email === where.email) ?? null
      },
    },
    document: {
      async findMany({ where }) {
        return [...documents.values()].filter((d) => d.userId === where.userId)
      },
      async count({ where }) {
        return [...documents.values()].filter((d) => d.userId === where.userId).length
      },
      async findUnique({ where }) {
        return documents.get(where.id) ?? null
      },
    },
    concept: {
      async findMany({ where }) {
        let list = [...concepts.values()].filter((c) => c.userId === where.userId)
        if (where.id?.in) {
          list = list.filter((c) => where.id.in.includes(c.id))
        }
        return list.map((c) => ({
          ...c,
          mastery: conceptMastery.get(c.id) || null,
          spacedReview: spacedReviews.get(c.id) || null,
          topics: [],
          sources: [],
          outgoingRelationships: [],
          incomingRelationships: [],
        }))
      },
      async findFirst({ where }) {
        const found = [...concepts.values()].find((c) => (
          c.userId === where.userId && (c.id === where.id || c.name === where.name)
        ))
        if (!found) return null
        return {
          ...found,
          mastery: conceptMastery.get(found.id) || null,
          spacedReview: spacedReviews.get(found.id) || null,
          topics: [],
          sources: [],
          outgoingRelationships: [],
          incomingRelationships: [],
        }
      },
    },
    conceptRelationship: {
      async findMany() {
        return [...conceptRelationships.values()]
      },
    },
    conceptMastery: {
      async findUnique({ where }) {
        return conceptMastery.get(where.conceptId) ?? null
      },
      async upsert({ where, create, update }) {
        const existing = conceptMastery.get(where.conceptId)
        if (existing) {
          const updated = { ...existing, ...update, updatedAt: new Date() }
          conceptMastery.set(where.conceptId, updated)
          return updated
        }
        const created = { id: crypto.randomUUID(), ...create, createdAt: new Date(), updatedAt: new Date() }
        conceptMastery.set(where.conceptId, created)
        return created
      },
      async create({ data }) {
        const item = { id: crypto.randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }
        conceptMastery.set(data.conceptId, item)
        return item
      },
      async update({ where, data }) {
        const item = { ...conceptMastery.get(where.conceptId), ...data, updatedAt: new Date() }
        conceptMastery.set(where.conceptId, item)
        return item
      },
    },
    quizSession: {
      async create({ data }) {
        const session = {
          id: crypto.randomUUID(),
          ...data,
          questions: data.questions?.create || [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        quizSessions.set(session.id, session)
        return session
      },
      async findFirst({ where }) {
        return quizSessions.get(where.id) ?? null
      },
      async findMany({ where }) {
        return [...quizSessions.values()].filter((s) => s.userId === where.userId)
      },
      async update({ where, data }) {
        const existing = quizSessions.get(where.id)
        const updated = { ...existing, ...data, updatedAt: new Date() }
        quizSessions.set(where.id, updated)
        return updated
      },
    },
    quizQuestion: {
      async update({ where, data }) {
        return data
      },
    },
    recoverySession: {
      async create({ data }) {
        const id = crypto.randomUUID()
        const session = {
          id,
          ...data,
          steps: (data.steps?.create || []).map((s, idx) => ({ id: `step-${idx}-${id}`, ...s, recoverySessionId: id })),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        recoverySessions.set(id, session)
        return session
      },
      async findFirst({ where }) {
        return recoverySessions.get(where.id) ?? null
      },
      async findMany({ where }) {
        return [...recoverySessions.values()].filter((s) => s.userId === where.userId)
      },
      async update({ where, data }) {
        const existing = recoverySessions.get(where.id)
        const updated = { ...existing, ...data, updatedAt: new Date() }
        recoverySessions.set(where.id, updated)
        return updated
      },
    },
    recoveryStep: {
      async findFirst({ where }) {
        for (const session of recoverySessions.values()) {
          const step = session.steps.find((s) => s.id === where.id)
          if (step) return { ...step, recoverySession: session }
        }
        return null
      },
      async findMany({ where }) {
        const session = recoverySessions.get(where.recoverySessionId)
        return session ? session.steps : []
      },
      async update({ where, data }) {
        for (const session of recoverySessions.values()) {
          const stepIdx = session.steps.findIndex((s) => s.id === where.id)
          if (stepIdx >= 0) {
            session.steps[stepIdx] = { ...session.steps[stepIdx], ...data, updatedAt: new Date() }
            return session.steps[stepIdx]
          }
        }
        return null
      },
    },
    spacedReview: {
      async findUnique({ where }) {
        return spacedReviews.get(where.conceptId) ?? null
      },
      async upsert({ where, create, update }) {
        const existing = spacedReviews.get(where.conceptId)
        if (existing) {
          const updated = { ...existing, ...update, updatedAt: new Date() }
          spacedReviews.set(where.conceptId, updated)
          return updated
        }
        const created = { id: crypto.randomUUID(), ...create, createdAt: new Date(), updatedAt: new Date() }
        spacedReviews.set(where.conceptId, created)
        return created
      },
      async create({ data }) {
        const created = { id: crypto.randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }
        spacedReviews.set(data.conceptId, created)
        return created
      },
    },
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body) headers['content-type'] = 'application/json'
  if (token) headers['cookie'] = `knowflow_session=${token}`
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

before(async () => {
  users = new Map()
  documents = new Map()
  concepts = new Map()
  conceptRelationships = new Map()
  conceptMastery = new Map()
  quizSessions = new Map()
  quizQuestions = new Map()
  recoverySessions = new Map()
  recoverySteps = new Map()
  spacedReviews = new Map()

  const userId = 'user-test-full-1'
  users.set(userId, { id: userId, email: 'learner@test.com', name: 'Knowledge Seeker' })

  // Seed sample concepts
  const c1 = {
    id: 'concept-1',
    userId,
    name: 'IP Addressing',
    definition: 'A numerical label assigned to each device connected to a computer network.',
    detailedExplanation: 'IPv4 uses 32-bit addresses organized into four decimal octets. IPv6 uses 128 bits.',
    simpleExplanation: 'Like a street address for your computer on the internet.',
    analogy: 'Postal address system for delivering mail.',
    difficulty: 'MEDIUM',
    importance: 'CRITICAL',
    examples: ['192.168.1.1', '10.0.0.1'],
  }
  const c2 = {
    id: 'concept-2',
    userId,
    name: 'Subnet Masks',
    definition: 'A 32-bit number used to divide an IP address into network and host components.',
    detailedExplanation: 'Subnetting allows network administrators to partition one network into multiple smaller subnets.',
    simpleExplanation: 'Tells routers which part of the address is the neighborhood and which is the house number.',
    difficulty: 'HARD',
    importance: 'HIGH',
    examples: ['255.255.255.0'],
  }
  concepts.set(c1.id, c1)
  concepts.set(c2.id, c2)

  const mockPrisma = createFullMockPrisma()
  server = createApp(mockPrisma).listen(0, '127.0.0.1')
  await once(server, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) {
    server.close()
    await once(server, 'close')
  }
})

test('textToPdfBuffer converts text into a valid PDF stream', async () => {
  const buf = await textToPdfBuffer('Sample Document', '# Introduction\nThis is a sample learning paragraph.')
  assert.ok(buf.length > 500)
  assert.ok(buf.subarray(0, 10).toString('latin1').includes('%PDF-'))
})

test('extractTextFromHtml extracts clean structured text', () => {
  const html = '<html><body><h1>Title</h1><p>Article body &amp; info.</p></body></html>'
  const text = extractTextFromHtml(html)
  assert.ok(text.includes('Title'))
  assert.ok(text.includes('Article body & info.'))
})

test('FSRS algorithm calculates progressive intervals and retention scores', () => {
  const initial = calculateFsrsNextState({ stability: 1.0, difficulty: 5.0, reps: 0 }, 3)
  assert.ok(initial.stability > 1.0)
  assert.ok(initial.intervalDays >= 1)
  assert.ok(initial.retentionScore > 0.3)

  // Test failure / relapse
  const failed = calculateFsrsNextState(initial, 1)
  assert.equal(failed.lapses, 1)
  assert.ok(failed.stability < initial.stability)
})

test('all learning-phase endpoints are mounted behind authentication', async () => {
  const paths = [
    '/api/learning/graph',
    '/api/quizzes',
    '/api/recovery',
    '/api/spaced-repetition/analytics',
  ]
  const responses = await Promise.all(paths.map((path) => request(path)))
  assert.deepEqual(responses.map((response) => response.status), paths.map(() => 401))
})

test('voice assistant performs upload navigation without needing AI credentials', async () => {
  const token = signSession('user-test-full-1')
  const response = await request('/api/voice-agent/chat', {
    method: 'POST',
    body: { message: 'Please go to the upload page' },
    token,
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    reply: 'Opening your documents.',
    action: { type: 'NAVIGATE', path: '/app/papers', label: 'your documents' },
  })
})
