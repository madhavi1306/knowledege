import assert from 'node:assert/strict'
import { test } from 'node:test'
import 'dotenv/config'
import { createApp } from '../src/app.js'
import { FileStoreRepository } from '../src/utils/file-store.js'
import { synthesizeGroundedTopicMaterial, createLearningService } from '../src/services/learning-service.js'
import { signSession, AUTH_COOKIE } from '../src/utils/token.js'

process.env.JWT_SECRET ||= 'knowflow-super-secure-jwt-secret-key-32chars'

test('synthesizeGroundedTopicMaterial produces all 12 required structured elements in easy English', () => {
  const topic = { name: 'Cellular Respiration' }
  const pages = [
    {
      pageNumber: 3,
      section: 'Chapter 2: Bioenergetics',
      headings: ['Cellular Respiration', 'Glycolysis Mechanism'],
      importantTerms: ['ATP', 'Mitochondria', 'Glycolysis', 'Substrate'],
      originalText: 'Cellular respiration converts glucose into ATP. In the mitochondria, oxygen enables the electron transport chain.',
    },
    {
      pageNumber: 4,
      section: 'Chapter 2: Bioenergetics',
      headings: ['Citric Acid Cycle'],
      importantTerms: ['Krebs Cycle', 'NADH'],
      originalText: 'The citric acid cycle processes acetyl-CoA to yield high-energy electron carriers.',
    },
  ]
  const concepts = [{ name: 'ATP Synthesis' }, { name: 'Enzyme Kinetics' }]

  const material = synthesizeGroundedTopicMaterial({ topic, pages, concepts, orderIndex: 1 })

  // 1. Title
  assert.equal(material.topicTitle, 'Cellular Respiration')
  // 2. Simple definition
  assert.match(material.simpleDefinition, /Cellular respiration/)
  // 3. Easy explanation
  assert.match(material.easyExplanation, /simple words/i)
  // 4. Detailed explanation
  assert.match(material.detailedExplanation, /Cellular Respiration/i)
  // 5. Step-by-step explanation
  assert.equal(Array.isArray(material.stepByStepExplanation), true)
  assert.ok(material.stepByStepExplanation.length >= 3)
  // 6. Real-world example
  assert.match(material.realWorldExample, /Think of Cellular Respiration/i)
  // 7. Important points
  assert.ok(material.importantPoints.length >= 2)
  // 8. Difficult words with word, simpleMeaning, explanation, example
  assert.ok(material.difficultWords.length >= 2)
  assert.ok(material.difficultWords[0].word)
  assert.ok(material.difficultWords[0].simpleMeaning)
  assert.ok(material.difficultWords[0].explanation)
  assert.ok(material.difficultWords[0].example)
  // 9. Related concepts
  assert.deepEqual(material.relatedConcepts, ['ATP Synthesis', 'Enzyme Kinetics'])
  // 10. Document page references
  assert.deepEqual(material.pageReferences, [3])
  // 11. Quick revision notes
  assert.ok(material.quickRevisionNotes.length >= 2)
  // 12. Key things to remember
  assert.ok(material.keyThingsToRemember.length >= 2)
  // Order index preserved
  assert.equal(material.orderIndex, 1)
})

test('learning service generates, persists, and regenerates structured topic material', async () => {
  const store = new FileStoreRepository()
  store.loaded = true
  const userId = 'usr-test-1'
  const docId = 'doc-test-1'
  const analysisId = 'analysis-test-1'

  // Seed user and document
  store.data.users.push({ id: userId, email: 'student@knowflow.app', name: 'Student' })
  store.data.documents.push({
    id: docId,
    userId,
    fileName: 'Biology_101.pdf',
    uploadStatus: 'ANALYSIS_COMPLETED',
    storageKey: 'bio.pdf',
    fileSize: 1024,
    contentHash: 'hash1',
    uploadedAt: new Date(),
  })
  store.data.analyses.push({
    id: analysisId,
    documentId: docId,
    userId,
    status: 'COMPLETED',
  })
  store.data.topics.push(
    { id: 'top-1', documentAnalysisId: analysisId, name: 'Photosynthesis', description: 'Light reactions' },
    { id: 'top-2', documentAnalysisId: analysisId, name: 'Calvin Cycle', description: 'Dark reactions', parentId: 'top-1' },
  )
  store.data.extractedPages.push({
    id: 'p-1',
    documentId: docId,
    documentAnalysisId: analysisId,
    pageNumber: 1,
    section: 'Plant Physiology',
    originalText: 'Photosynthesis converts solar light into chemical energy stored in carbohydrates.',
    headings: ['Photosynthesis'],
    importantTerms: ['Chloroplast', 'Thylakoid'],
  })

  const service = createLearningService(store)

  // 1. Get workspace
  const workspace = await service.getLearningWorkspace(userId, docId)
  assert.equal(workspace.document.fileName, 'Biology_101.pdf')
  assert.equal(workspace.overview.totalTopics, 2)
  assert.equal(workspace.overview.completedTopics, 0)
  assert.equal(workspace.chapters.length, 1)

  // 2. Generate material for topic 1
  const material = await service.generateTopicMaterial(userId, docId, 'top-1')
  assert.equal(material.topicTitle, 'Photosynthesis')
  assert.equal(material.status, 'NOT_STARTED')
  assert.ok(material.pageReferences.includes(1))

  // Verify persistence
  const savedMaterial = await store.topicLearningMaterial.findUnique({ where: { topicId: 'top-1' } })
  assert.ok(savedMaterial)
  assert.equal(savedMaterial.topicTitle, 'Photosynthesis')

  // 3. Update completion status
  const updated = await service.updateTopicStatus(userId, docId, 'top-1', 'COMPLETED')
  assert.equal(updated.status, 'COMPLETED')

  // Check updated workspace stats
  const updatedWorkspace = await service.getLearningWorkspace(userId, docId)
  assert.equal(updatedWorkspace.overview.completedTopics, 1)
  assert.equal(updatedWorkspace.overview.progressPercent, 50)

  // 4. Test regeneration
  const regenerated = await service.generateTopicMaterial(userId, docId, 'top-1', { forceRegenerate: true })
  assert.ok(regenerated)
  assert.equal(regenerated.topicTitle, 'Photosynthesis')
})

test('learning routes expose workspace, topic materials, and status updates over HTTP', async () => {
  const store = new FileStoreRepository()
  store.loaded = true
  const userId = 'usr-route-1'
  const docId = 'doc-route-1'
  const analysisId = 'analysis-route-1'

  store.data.users.push({ id: userId, email: 'route@knowflow.app', name: 'Route User' })
  store.data.documents.push({
    id: docId,
    userId,
    fileName: 'Physics_Mechanics.pdf',
    uploadStatus: 'ANALYSIS_COMPLETED',
    storageKey: 'physics.pdf',
    fileSize: 2048,
    contentHash: 'hash2',
    uploadedAt: new Date(),
  })
  store.data.analyses.push({ id: analysisId, documentId: docId, userId, status: 'COMPLETED' })
  store.data.topics.push({ id: 'top-phy-1', documentAnalysisId: analysisId, name: 'Newton Laws', description: 'Force & Motion' })
  store.data.extractedPages.push({
    id: 'p-phy-1',
    documentId: docId,
    documentAnalysisId: analysisId,
    pageNumber: 5,
    section: 'Classical Mechanics',
    originalText: 'Newton second law states that acceleration is directly proportional to net force.',
    headings: ['Newton Laws'],
    importantTerms: ['Inertia', 'Acceleration'],
  })

  const app = createApp(store)
  const sessionToken = signSession(userId)

  const server = app.listen(0)
  const port = server.address().port
  const baseUrl = `http://localhost:${port}`

  try {
    // 1. GET /api/learning/:documentId
    const wsRes = await fetch(`${baseUrl}/api/learning/${docId}`, {
      headers: { Cookie: `${AUTH_COOKIE}=${sessionToken}` },
    })
    assert.equal(wsRes.status, 200)
    const wsData = await wsRes.json()
    assert.equal(wsData.document.fileName, 'Physics_Mechanics.pdf')
    assert.equal(wsData.overview.totalTopics, 1)

    // 2. GET /api/learning/:documentId/topics/:topicId (generates on-demand)
    const topicRes = await fetch(`${baseUrl}/api/learning/${docId}/topics/top-phy-1`, {
      headers: { Cookie: `${AUTH_COOKIE}=${sessionToken}` },
    })
    assert.equal(topicRes.status, 200)
    const topicData = await topicRes.json()
    assert.equal(topicData.material.topicTitle, 'Newton Laws')
    assert.ok(topicData.material.difficultWords.length > 0)

    // 3. PATCH /api/learning/:documentId/topics/:topicId/status
    const patchRes = await fetch(`${baseUrl}/api/learning/${docId}/topics/top-phy-1/status`, {
      method: 'PATCH',
      headers: {
        Cookie: `${AUTH_COOKIE}=${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'COMPLETED' }),
    })
    assert.equal(patchRes.status, 200)
    const patchData = await patchRes.json()
    assert.equal(patchData.material.status, 'COMPLETED')

    // 4. POST /api/learning/:documentId/topics/:topicId/regenerate
    const regenRes = await fetch(`${baseUrl}/api/learning/${docId}/topics/top-phy-1/regenerate`, {
      method: 'POST',
      headers: { Cookie: `${AUTH_COOKIE}=${sessionToken}` },
    })
    assert.equal(regenRes.status, 200)
    const regenData = await regenRes.json()
    assert.equal(regenData.material.topicTitle, 'Newton Laws')
  } finally {
    server.close()
  }
})
