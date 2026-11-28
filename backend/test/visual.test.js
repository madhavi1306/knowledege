import assert from 'node:assert/strict'
import { test } from 'node:test'
import 'dotenv/config'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createApp } from '../src/app.js'
import { FileStoreRepository } from '../src/utils/file-store.js'
import { createVisualService } from '../src/services/visual-service.js'
import { signSession, AUTH_COOKIE } from '../src/utils/token.js'

process.env.JWT_SECRET ||= 'knowflow-super-secure-jwt-secret-key-32chars'

const visionExplanation = {
  title: 'Microservices request flow',
  whatItRepresents: 'The page shows requests routed from an API Gateway to two services.',
  purpose: 'It explains the visible request-routing architecture.',
  partsExplanation: [
    { part: 'API Gateway', explanation: 'The labeled entry point for requests.' },
    { part: 'Auth Service', explanation: 'A service shown receiving a request.' },
  ],
  labelsExplanation: [
    { label: 'API Gateway', meaning: 'The labeled request entry point.' },
    { label: 'Auth Service', meaning: 'The service label shown in the diagram.' },
  ],
  arrowsExplanation: 'The arrow points from API Gateway to Auth Service.',
  connections: [{ from: 'API Gateway', to: 'Auth Service', relationship: 'The visible arrow connects them.' }],
  stepByStepProcess: ['A request enters the API Gateway.', 'The visible arrow leads to Auth Service.'],
  easyExample: 'Like a reception desk directing a visitor to the correct office.',
  difficultWords: [{
    word: 'Gateway',
    simpleMeaning: 'An entry point between systems.',
    explanation: 'It receives requests before they reach a service.',
    example: 'A building entrance directs visitors inside.',
  }],
  importantPoints: ['The arrow is visible from API Gateway to Auth Service.'],
  simplifiedDiagram: 'graph LR\n A[API Gateway] --> B[Auth Service]',
}

function createVisualTestStore(documentId, userId, analysisId) {
  const store = new FileStoreRepository()
  store.loaded = true
  store.data.users.push({ id: userId, email: `${userId}@knowflow.app`, name: 'Visual Student' })
  store.data.documents.push({
    id: documentId,
    userId,
    fileName: 'System_Architecture.pdf',
    uploadStatus: 'ANALYSIS_COMPLETED',
    storageKey: 'sys.pdf',
    fileSize: 2048,
    contentHash: 'hashvis1',
    uploadedAt: new Date(),
  })
  store.data.analyses.push({ id: analysisId, documentId, userId, status: 'COMPLETED' })
  store.data.extractedPages.push({
    id: `page-${documentId}`,
    documentId,
    documentAnalysisId: analysisId,
    pageNumber: 2,
    section: 'Microservices Flowchart',
    originalText: 'Figure 2: Microservices data flow.',
    headings: ['Microservices Flowchart'],
    importantTerms: ['API Gateway', 'Auth Service', 'Payment Service'],
    visuals: { hasDiagramOrChart: true, imageCount: 1, drawingElementCount: 50 },
    tables: [{
      header: ['Service', 'Latency (ms)'],
      rows: [['Auth', '12'], ['Payment', '45']],
    }],
  })
  return store
}

test('visual analysis uses the rendered PDF page and preserves labels and arrows from the vision result', async () => {
  const store = createVisualTestStore('doc-vision-1', 'user-vision-1', 'analysis-vision-1')
  const service = createVisualService(store, {
    renderPageVisualImage: async (_pdfPath, _pageNumber, targetPath) => targetPath,
    analyzeVisualImage: async ({ imagePath, visualType, page }) => {
      assert.match(imagePath, /doc-vision-1_p2\.png$/)
      assert.equal(page.pageNumber, 2)
      return visionExplanation
    },
  })

  const visuals = await service.listVisuals('user-vision-1', 'doc-vision-1')
  const flowchart = visuals.find((visual) => visual.type === 'FLOWCHART')
  assert.equal(flowchart.status, 'COMPLETED')
  assert.equal(flowchart.labelsExplanation[0].label, 'API Gateway')
  assert.match(flowchart.arrowsExplanation, /API Gateway to Auth Service/)
  assert.equal(flowchart.connections[0].to, 'Auth Service')
})

test('vision requests include the actual rendered page image and use backend credentials', async () => {
  const store = createVisualTestStore('doc-provider-1', 'user-provider-1', 'analysis-provider-1')
  const directory = await mkdtemp(path.join(os.tmpdir(), 'knowflow-vision-'))
  const previous = {
    key: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_VISION_MODEL,
  }
  process.env.OPENAI_API_KEY = 'test-vision-key'
  process.env.OPENAI_VISION_MODEL = 'test-vision-model'
  const requests = []

  try {
    const service = createVisualService(store, {
      storageDir: directory,
      renderPageVisualImage: async (_pdfPath, _pageNumber, targetPath) => {
        await mkdir(path.dirname(targetPath), { recursive: true })
        await writeFile(targetPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/r+QAAAAASUVORK5CYII=', 'base64'))
        return targetPath
      },
      fetchImpl: async (url, options) => {
        requests.push({ url, options })
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: JSON.stringify(visionExplanation) } }] }),
        }
      },
    })

    const visuals = await service.listVisuals('user-provider-1', 'doc-provider-1')
    assert.equal(visuals.length, 2)
    assert.equal(requests.length, 2)
    assert.equal(requests[0].options.headers.Authorization, 'Bearer test-vision-key')
    const content = JSON.parse(requests[0].options.body).messages[1].content
    assert.match(content[1].image_url.url, /^data:image\/png;base64,/)
  } finally {
    if (previous.key === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous.key
    if (previous.model === undefined) delete process.env.OPENAI_VISION_MODEL
    else process.env.OPENAI_VISION_MODEL = previous.model
    await rm(directory, { recursive: true, force: true })
  }
})

test('visual extraction failure leaves the visual unanalyzed instead of guessing labels', async () => {
  const store = createVisualTestStore('doc-failed-1', 'user-failed-1', 'analysis-failed-1')
  const service = createVisualService(store, {
    renderPageVisualImage: async () => {
      throw new Error('PDF image renderer unavailable')
    },
    analyzeVisualImage: async () => visionExplanation,
  })

  const visuals = await service.listVisuals('user-failed-1', 'doc-failed-1')
  assert.ok(visuals.length > 0)
  assert.equal(visuals[0].status, 'FAILED')
  assert.deepEqual(visuals[0].labelsExplanation, [])
  assert.match(visuals[0].error, /could not be rendered/)
})

test('visual service extracts, persists, and answers visual-specific questions', async () => {
  const store = new FileStoreRepository()
  store.loaded = true
  const userId = 'usr-vis-1'
  const docId = 'doc-vis-1'
  const analysisId = 'analysis-vis-1'

  store.data.users.push({ id: userId, email: 'visual@knowflow.app', name: 'Visual Student' })
  store.data.documents.push({
    id: docId,
    userId,
    fileName: 'System_Architecture.pdf',
    uploadStatus: 'ANALYSIS_COMPLETED',
    storageKey: 'sys.pdf',
    fileSize: 2048,
    contentHash: 'hashvis1',
    uploadedAt: new Date(),
  })
  store.data.analyses.push({ id: analysisId, documentId: docId, userId, status: 'COMPLETED' })
  store.data.extractedPages.push({
    id: 'p-vis-1',
    documentId: docId,
    documentAnalysisId: analysisId,
    pageNumber: 2,
    section: 'Microservices Flowchart',
    originalText: 'Figure 2: Microservices data flow. Directional arrows indicate request routing from API Gateway to Auth and Payment services.',
    headings: ['Microservices Flowchart'],
    importantTerms: ['API Gateway', 'Auth Service', 'Payment Service'],
    visuals: { hasDiagramOrChart: true, imageCount: 1, drawingElementCount: 50 },
    tables: [{
      header: ['Service', 'Latency (ms)'],
      rows: [['Auth', '12'], ['Payment', '45']],
    }],
  })

  const service = createVisualService(store, {
    renderPageVisualImage: async (_pdfPath, _pageNumber, targetPath) => targetPath,
    analyzeVisualImage: async ({ visualType }) => ({
      ...visionExplanation,
      title: visualType === 'TABLE' ? 'Service latency table' : visionExplanation.title,
      arrowsExplanation: visualType === 'TABLE' ? null : visionExplanation.arrowsExplanation,
      connections: visualType === 'TABLE' ? [] : visionExplanation.connections,
    }),
  })

  // 1. List visuals (syncs and detects both Table and Flowchart)
  const visuals = await service.listVisuals(userId, docId)
  assert.ok(visuals.length >= 2)

  const tableVisual = visuals.find((v) => v.type === 'TABLE')
  assert.ok(tableVisual)
  assert.equal(tableVisual.pageNumber, 2)
  assert.equal(tableVisual.status, 'COMPLETED')

  const flowVisual = visuals.find((v) => v.type === 'FLOWCHART')
  assert.ok(flowVisual)
  assert.equal(flowVisual.pageNumber, 2)
  assert.match(flowVisual.arrowsExplanation, /API Gateway to Auth Service/)

  // 2. Get specific visual by ID
  const fetched = await service.getVisual(userId, docId, flowVisual.id)
  assert.equal(fetched.id, flowVisual.id)
  assert.equal(fetched.title, flowVisual.title)

  // 3. Visual Q&A: Ask questions about arrows & flow
  const arrowAnswer = await service.answerVisualQuestion(userId, docId, flowVisual.id, 'What do the arrows in this diagram mean?')
  assert.ok(arrowAnswer.answer.toLowerCase().includes('arrow') || arrowAnswer.answer.toLowerCase().includes('flow'))
  assert.equal(arrowAnswer.pageNumber, 2)

  // 4. Visual Q&A: Ask questions about parts
  const partsAnswer = await service.answerVisualQuestion(userId, docId, flowVisual.id, 'What are the main components of this visual?')
  assert.ok(partsAnswer.answer.toLowerCase().includes('components') || partsAnswer.answer.toLowerCase().includes('gateway'))

  // 5. Visual Q&A: Ask questions about real-world example
  const exampleAnswer = await service.answerVisualQuestion(userId, docId, flowVisual.id, 'Give me an easy example of this diagram')
  assert.ok(exampleAnswer.answer.toLowerCase().includes('example') || exampleAnswer.answer.toLowerCase().includes('think of'))
})

test('visual HTTP routes expose visual lists, detail views, and interactive Q&A', async () => {
  const store = new FileStoreRepository()
  store.loaded = true
  const userId = 'usr-route-vis'
  const docId = 'doc-route-vis'
  const analysisId = 'analysis-route-vis'

  store.data.users.push({ id: userId, email: 'routevis@knowflow.app', name: 'Route Visual' })
  store.data.documents.push({
    id: docId,
    userId,
    fileName: 'Geographic_Information_Map.pdf',
    uploadStatus: 'ANALYSIS_COMPLETED',
    storageKey: 'map.pdf',
    fileSize: 4096,
    contentHash: 'hashvis2',
    uploadedAt: new Date(),
  })
  store.data.analyses.push({ id: analysisId, documentId: docId, userId, status: 'COMPLETED' })
  store.data.extractedPages.push({
    id: 'p-map-1',
    documentId: docId,
    documentAnalysisId: analysisId,
    pageNumber: 7,
    section: 'Topographic Soil Map',
    originalText: 'Figure 7: Topographic elevation map showing geological strata and moisture contours.',
    headings: ['Topographic Soil Map'],
    importantTerms: ['Elevation Contour', 'Water Table', 'Bedrock'],
    visuals: { hasDiagramOrChart: true, imageCount: 1, drawingElementCount: 25 },
    tables: [],
  })

  const app = createApp(store, {
    renderPageVisualImage: async (_pdfPath, _pageNumber, targetPath) => targetPath,
    analyzeVisualImage: async () => visionExplanation,
  })
  const sessionToken = signSession(userId)

  const server = app.listen(0)
  const port = server.address().port
  const baseUrl = `http://localhost:${port}`

  try {
    // 1. GET /api/visuals/:documentId
    const listRes = await fetch(`${baseUrl}/api/visuals/${docId}`, {
      headers: { Cookie: `${AUTH_COOKIE}=${sessionToken}` },
    })
    assert.equal(listRes.status, 200)
    const listData = await listRes.json()
    assert.ok(listData.visuals.length >= 1)
    const mapVisual = listData.visuals[0]
    assert.equal(mapVisual.pageNumber, 7)

    // 2. GET /api/visuals/:documentId/:visualId
    const getRes = await fetch(`${baseUrl}/api/visuals/${docId}/${mapVisual.id}`, {
      headers: { Cookie: `${AUTH_COOKIE}=${sessionToken}` },
    })
    assert.equal(getRes.status, 200)
    const getData = await getRes.json()
    assert.equal(getData.visual.id, mapVisual.id)
    assert.ok(getData.visual.whatItRepresents)
    assert.ok(getData.visual.partsExplanation.length >= 1)

    // 3. POST /api/visuals/:documentId/:visualId/ask (Visual Q&A)
    const askRes = await fetch(`${baseUrl}/api/visuals/${docId}/${mapVisual.id}/ask`, {
      method: 'POST',
      headers: {
        Cookie: `${AUTH_COOKIE}=${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: 'Explain what this map represents in simple terms' }),
    })
    assert.equal(askRes.status, 200)
    const askData = await askRes.json()
    assert.ok(askData.answer.length > 20)
    assert.equal(askData.pageNumber, 7)
  } finally {
    server.close()
  }
})
