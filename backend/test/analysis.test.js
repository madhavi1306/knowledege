import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createApp } from '../src/app.js'
import { signSession } from '../src/utils/token.js'

process.env.JWT_SECRET = 'test-only-secret-for-knowflow-auth-suite'
process.env.NODE_ENV = 'test'

let server
let baseUrl
let storageDir
let app
let memory
let attempts

function createMemoryPrisma() {
  const state = {
    documents: new Map(),
    analyses: new Map(),
    pages: [],
    topics: new Map(),
    concepts: new Map(),
    topicConcepts: new Map(),
    sources: new Map(),
    relationships: new Map(),
  }
  const prisma = {}

  prisma.document = {
    async findMany({ where }) {
      return [...state.documents.values()].filter((document) => (
        document.userId === where.userId && where.id.in.includes(document.id)
      ))
    },
    async findFirst({ where }) {
      const document = state.documents.get(where.id)
      return document?.userId === where.userId ? document : null
    },
    async update({ where, data }) {
      const document = { ...state.documents.get(where.id), ...data, updatedAt: new Date() }
      state.documents.set(where.id, document)
      return document
    },
  }

  prisma.documentAnalysis = {
    async updateMany({ where, data }) {
      let count = 0
      for (const [documentId, analysis] of state.analyses) {
        const matchesId = !where.id || analysis.id === where.id
        const matchesUpdatedAt = !where.updatedAt?.lt || analysis.updatedAt < where.updatedAt.lt
        if (analysis.status === where.status && matchesId && matchesUpdatedAt) {
          state.analyses.set(documentId, { ...analysis, ...data, updatedAt: new Date() })
          count += 1
        }
      }
      return { count }
    },
    async findMany({ where }) {
      return [...state.analyses.values()]
        .filter((analysis) => analysis.status === where.status)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(({ id, documentId, userId }) => ({ id, documentId, userId }))
    },
    async findUnique({ where, include }) {
      const analysis = where.documentId
        ? state.analyses.get(where.documentId)
        : [...state.analyses.values()].find((item) => item.id === where.id)
      if (!analysis || !include) return analysis ?? null
      return {
        ...analysis,
        topics: [...state.topics.values()].filter((topic) => topic.documentAnalysisId === analysis.id),
        conceptSources: [...state.sources.values()]
          .filter((source) => source.documentAnalysisId === analysis.id)
          .map((source) => ({
            ...source,
            concept: state.concepts.get(source.conceptId),
          })),
        conceptRelationships: [...state.relationships.values()]
          .filter((relationship) => relationship.documentAnalysisId === analysis.id)
          .map((relationship) => ({
            ...relationship,
            fromConcept: state.concepts.get(relationship.fromConceptId),
            toConcept: state.concepts.get(relationship.toConceptId),
          })),
      }
    },
    async upsert({ where, create, update }) {
      const existing = state.analyses.get(where.documentId)
      const analysis = existing
        ? { ...existing, ...update, updatedAt: new Date() }
        : {
            id: randomUUID(),
            ...create,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
      state.analyses.set(where.documentId, analysis)
      return analysis
    },
    async update({ where, data }) {
      const [documentId, existing] = [...state.analyses.entries()].find(([, item]) => item.id === where.id)
      const analysis = { ...existing, ...data, updatedAt: new Date() }
      state.analyses.set(documentId, analysis)
      return analysis
    },
  }

  prisma.extractedPage = {
    async deleteMany({ where }) {
      state.pages = state.pages.filter((page) => page.documentAnalysisId !== where.documentAnalysisId)
    },
    async createMany({ data }) {
      state.pages.push(...data.map((page) => ({ id: randomUUID(), ...page })))
    },
  }

  prisma.topic = {
    async deleteMany({ where }) {
      const ids = new Set(
        [...state.topics.values()]
          .filter((topic) => topic.documentAnalysisId === where.documentAnalysisId)
          .map((topic) => topic.id),
      )
      for (const id of ids) state.topics.delete(id)
      for (const [key, link] of state.topicConcepts) {
        if (ids.has(link.topicId)) state.topicConcepts.delete(key)
      }
    },
    async create({ data }) {
      const topic = { id: randomUUID(), ...data, createdAt: new Date() }
      state.topics.set(topic.id, topic)
      return topic
    },
    async findMany({ where }) {
      return [...state.topics.values()]
        .filter((topic) => {
          const analysis = [...state.analyses.values()].find((item) => item.id === topic.documentAnalysisId)
          return analysis?.userId === where.documentAnalysis.userId
            && (!where.documentAnalysis.documentId || analysis.documentId === where.documentAnalysis.documentId)
        })
        .map((topic) => {
          const analysis = [...state.analyses.values()].find((item) => item.id === topic.documentAnalysisId)
          const document = state.documents.get(analysis.documentId)
          return {
            ...topic,
            documentAnalysis: { document: { id: document.id, fileName: document.fileName } },
          }
        })
    },
  }

  prisma.concept = {
    async findUnique({ where }) {
      return [...state.concepts.values()].find((concept) => (
        concept.userId === where.userId_normalizedName.userId
        && concept.normalizedName === where.userId_normalizedName.normalizedName
      )) ?? null
    },
    async findFirst({ where, include }) {
      const concept = [...state.concepts.values()].find((item) => (
        item.id === where.id && item.userId === where.userId
      ))
      if (!concept || !include) return concept ?? null
      return {
        ...concept,
        sources: [...state.sources.values()]
          .filter((source) => source.conceptId === concept.id)
          .map((source) => ({
            ...source,
            document: state.documents.get(source.documentId),
            documentAnalysis: state.analyses.get(source.documentId),
          })),
        outgoingRelationships: [...state.relationships.values()]
          .filter((relationship) => relationship.fromConceptId === concept.id)
          .map((relationship) => ({ ...relationship, toConcept: state.concepts.get(relationship.toConceptId) })),
        incomingRelationships: [...state.relationships.values()]
          .filter((relationship) => relationship.toConceptId === concept.id)
          .map((relationship) => ({ ...relationship, fromConcept: state.concepts.get(relationship.fromConceptId) })),
      }
    },
    async findMany({ where, cursor, skip = 0, take }) {
      const results = [...state.concepts.values()]
        .filter((concept) => {
          if (concept.userId !== where.userId) return false
          return !where.name || concept.name.toLowerCase().includes(where.name.contains.toLowerCase())
        })
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      const start = cursor ? results.findIndex((concept) => concept.id === cursor.id) + skip : 0
      return results.slice(start, start + take).map((concept) => ({
        ...concept,
        ...(where.name || take ? { _count: { sources: [...state.sources.values()].filter((source) => source.conceptId === concept.id).length } } : {}),
      }))
    },
    async create({ data }) {
      const concept = { id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }
      state.concepts.set(concept.id, concept)
      return concept
    },
    async update({ where, data }) {
      const concept = { ...state.concepts.get(where.id), ...data, updatedAt: new Date() }
      state.concepts.set(concept.id, concept)
      return concept
    },
    async deleteMany({ where }) {
      const orphaned = [...state.concepts.values()].filter((concept) => (
        concept.userId === where.userId
        && ![...state.sources.values()].some((source) => source.conceptId === concept.id)
      ))
      for (const concept of orphaned) state.concepts.delete(concept.id)
    },
  }

  prisma.topicConcept = {
    async upsert({ where, create }) {
      const key = `${where.topicId_conceptId.topicId}:${where.topicId_conceptId.conceptId}`
      const link = state.topicConcepts.get(key) || create
      state.topicConcepts.set(key, link)
      return link
    },
  }

  prisma.conceptSource = {
    async deleteMany({ where }) {
      for (const [key, source] of state.sources) {
        if (source.documentAnalysisId === where.documentAnalysisId) state.sources.delete(key)
      }
    },
    async upsert({ where, create, update }) {
      const keyData = where.conceptId_documentAnalysisId_pageNumber
      const key = `${keyData.conceptId}:${keyData.documentAnalysisId}:${keyData.pageNumber}`
      const source = state.sources.has(key) ? { ...state.sources.get(key), ...update } : { id: randomUUID(), ...create }
      state.sources.set(key, source)
      return source
    },
  }

  prisma.conceptRelationship = {
    async deleteMany({ where }) {
      for (const [key, relation] of state.relationships) {
        if (relation.documentAnalysisId === where.documentAnalysisId) state.relationships.delete(key)
      }
    },
    async upsert({ where, create, update }) {
      const data = where.documentAnalysisId_fromConceptId_toConceptId_type
      const key = `${data.documentAnalysisId}:${data.fromConceptId}:${data.toConceptId}:${data.type}`
      const relation = state.relationships.has(key)
        ? { ...state.relationships.get(key), ...update }
        : { id: randomUUID(), ...create }
      state.relationships.set(key, relation)
      return relation
    },
  }

  prisma.$transaction = (operation) => operation(prisma)
  return { prisma, state }
}

function addDocument(state, id, userId, fileName) {
  state.documents.set(id, {
    id,
    userId,
    fileName,
    originalFileName: fileName,
    storageKey: `${randomUUID()}.pdf`,
    fileSize: 1024,
    mimeType: 'application/pdf',
    uploadStatus: 'UPLOADED',
    uploadedAt: new Date(),
    updatedAt: new Date(),
  })
}

function analysisOutput(pageText, lowerCaseNames = false) {
  const respiration = lowerCaseNames ? 'cellular respiration' : 'Cellular respiration'
  const atp = lowerCaseNames ? 'atp' : 'ATP'
  const respirationQuote = pageText.split('\n')[0]
  const atpQuote = pageText.split('\n')[1]
  return {
    subject: 'Biology',
    topics: [{
      name: lowerCaseNames ? 'cellular energy' : 'Cellular energy',
      description: 'Energy conversion and use in cells.',
      subtopics: [{
        name: 'Energy conversion',
        description: 'How cells convert stored energy.',
      }],
    }],
    concepts: [
      {
        name: respiration,
        definition: 'A process cells use to release energy from glucose.',
        explanation: 'It makes usable energy available to cellular processes.',
        topicNames: ['Cellular energy'],
        prerequisites: [],
        relatedConcepts: [atp],
        examples: [],
        formulas: [],
        importantFacts: [],
        sourceReferences: [{ pageNumber: 1, quote: respirationQuote }],
      },
      {
        name: atp,
        definition: 'A molecule cells use to store and transfer energy.',
        explanation: 'ATP supplies energy for cellular work.',
        topicNames: ['Energy conversion'],
        prerequisites: [],
        relatedConcepts: [respiration],
        examples: [],
        formulas: [],
        importantFacts: [],
        sourceReferences: [{ pageNumber: 1, quote: atpQuote }],
      },
    ],
    relationships: [{
      fromConcept: respiration,
      toConcept: atp,
      type: 'RELATED',
      evidence: 'The page connects respiration with ATP production.',
      sourceReferences: [{ pageNumber: 1, quote: respirationQuote }],
    }],
  }
}

function authCookie(userId) {
  return `knowflow_session=${signSession(userId)}`
}

async function request(pathname, { method = 'GET', userId, body } = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(userId ? { cookie: authCookie(userId) } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

before(async () => {
  storageDir = await mkdtemp(path.join(os.tmpdir(), 'knowflow-analysis-'))
  memory = createMemoryPrisma()
  addDocument(memory.state, 'doc-one', 'user-a', 'cellular-energy-one.pdf')
  addDocument(memory.state, 'doc-two', 'user-a', 'cellular-energy-two.pdf')
  addDocument(memory.state, 'doc-private', 'user-b', 'private-paper.pdf')
  addDocument(memory.state, 'doc-retry', 'user-a', 'retry-paper.pdf')
  attempts = new Map()

  const ai = {
    async analyzeChunk({ pages }) {
      const text = pages[0].originalText
      if (text.startsWith('Retry passage') && !attempts.has(text)) {
        attempts.set(text, 1)
        throw new Error('The AI provider returned HTTP 503. Check provider settings and retry.')
      }
      return analysisOutput(text, text.includes('releases energy'))
    },
  }
  const extractPages = async (filePath) => {
    const document = [...memory.state.documents.values()].find(
      (item) => path.basename(filePath) === item.storageKey,
    )
    const text = document.id === 'doc-one'
      ? 'Cellular respiration converts glucose into ATP.\nATP stores usable energy.'
      : document.id === 'doc-two'
        ? 'Cellular respiration releases energy from glucose.\nATP stores usable energy for cell work.'
        : 'Retry passage connects cellular respiration with ATP.\nATP stores usable energy.'
    return {
      pageCount: 1,
      pages: [{
        pageNumber: 1,
        originalText: text,
        textContext: text,
        section: 'Cellular energy',
        headings: ['Cellular energy'],
        subheadings: [],
        paragraphs: text.split('\n'),
        definitions: [],
        examples: [],
        formulas: [],
        tables: [],
        importantTerms: ['ATP'],
        sections: [],
      }],
    }
  }

  app = createApp(
    memory.prisma,
    { storageDir, concurrency: 1 },
    { ai, extractPages },
  )
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (app) await app.locals.analysisService.waitForIdle()
  if (app) await app.locals.analysisService.stop()
  if (server) {
    server.close()
    await once(server, 'close')
  }
  if (storageDir) await rm(storageDir, { recursive: true, force: true })
})

test('batch analysis is private, grounded, and deduplicates concepts across PDFs', async () => {
  const unauthorized = await request('/api/analysis/doc-one/status')
  assert.equal(unauthorized.status, 401)

  const partialPrivateBatch = await request('/api/analysis/batch', {
    method: 'POST',
    userId: 'user-a',
    body: { documentIds: ['doc-one', 'doc-private'] },
  })
  assert.equal(partialPrivateBatch.status, 404)
  assert.equal(memory.state.analyses.size, 0)

  const started = await request('/api/analysis/batch', {
    method: 'POST',
    userId: 'user-a',
    body: { documentIds: ['doc-one', 'doc-two'] },
  })
  assert.equal(started.status, 202)
  assert.equal((await started.json()).analyses.length, 2)
  await app.locals.analysisService.waitForIdle()

  const firstStatus = await request('/api/analysis/doc-one/status', { userId: 'user-a' })
  assert.equal((await firstStatus.json()).status.status, 'COMPLETED')
  const secondStatus = await request('/api/analysis/doc-two/status', { userId: 'user-a' })
  assert.equal((await secondStatus.json()).status.status, 'COMPLETED')
  const detail = await request('/api/analysis/doc-one', { userId: 'user-a' })
  const body = await detail.json()
  assert.equal(body.analysis.subject, 'Biology')
  assert.equal(body.analysis.topics[0].subtopics[0].name, 'Energy conversion')
  assert.ok(body.analysis.concepts[0].sourceReferences[0].pageNumber === 1)
  assert.equal(body.analysis.relationships[0].sourcePageNumbers[0], 1)
  assert.equal(body.analysis.concepts.find((concept) => concept.name.toLowerCase() === 'atp').sourceReferences.length, 1)
  const extractedPage = memory.state.pages.find((page) => page.documentId === 'doc-one')
  assert.equal(extractedPage.pageNumber, 1)
  assert.match(extractedPage.originalText, /Cellular respiration converts glucose/)
  assert.equal(extractedPage.section, 'Cellular energy')

  const concepts = await request('/api/analysis/concepts?search=cellular&limit=20', { userId: 'user-a' })
  const conceptList = await concepts.json()
  assert.equal(conceptList.items.length, 1)
  assert.equal(conceptList.items[0].sourceCount, 2)
  const conceptDetails = await request(`/api/analysis/concepts/${conceptList.items[0].id}`, { userId: 'user-a' })
  assert.equal((await conceptDetails.json()).concept.sources.length, 2)

  const topics = await request('/api/analysis/topics?documentId=doc-one', { userId: 'user-a' })
  assert.equal((await topics.json()).topics.length, 2)

  const otherUserStatus = await request('/api/analysis/doc-one/status', { userId: 'user-b' })
  assert.equal(otherUserStatus.status, 404)
  const otherUserConcept = await request(`/api/analysis/concepts/${conceptList.items[0].id}`, { userId: 'user-b' })
  assert.equal(otherUserConcept.status, 404)
})

test('failed analysis records an actionable error and can be retried', async () => {
  const firstAttempt = await request('/api/analysis/doc-retry', {
    method: 'POST',
    userId: 'user-a',
  })
  assert.equal(firstAttempt.status, 202)
  await app.locals.analysisService.waitForIdle()

  const failed = await request('/api/analysis/doc-retry/status', { userId: 'user-a' })
  const failedStatus = (await failed.json()).status
  assert.equal(failedStatus.status, 'FAILED')
  assert.match(failedStatus.error, /HTTP 503/)

  const retry = await request('/api/analysis/doc-retry', {
    method: 'POST',
    userId: 'user-a',
  })
  assert.equal(retry.status, 202)
  await app.locals.analysisService.waitForIdle()
  const completed = await request('/api/analysis/doc-retry/status', { userId: 'user-a' })
  assert.equal((await completed.json()).status.status, 'COMPLETED')
})

test('bounded queue prefetch eventually analyzes every queued paper', async () => {
  const documentIds = Array.from({ length: 105 }, (_, index) => `queued-${index}`)
  await Promise.all(documentIds.map(async (id) => {
    addDocument(memory.state, id, 'user-a', `${id}.pdf`)
    const document = memory.state.documents.get(id)
    await writeFile(path.join(storageDir, document.storageKey), '')
  }))

  const response = await request('/api/analysis/batch', {
    method: 'POST',
    userId: 'user-a',
    body: { documentIds },
  })
  assert.equal(response.status, 202)
  await app.locals.analysisService.waitForIdle()

  assert.equal(documentIds.filter((id) => memory.state.analyses.get(id)?.status === 'COMPLETED').length, 105)
})
