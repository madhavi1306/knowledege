import assert from 'node:assert/strict'

const BASE_URL = 'http://localhost:4000'

async function runE2E() {
  console.log('--- Starting Phase 10 Live End-to-End Verification ---')

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/api/health`)
  assert.equal(healthRes.status, 200)
  const health = await healthRes.json()
  console.log('✓ Backend Health:', health)
  assert.equal(health.phase, 10, 'Backend must report phase: 10')

  // 2. Register Student User
  const timestamp = Date.now()
  const userEmail = `phase10_student_${timestamp}@example.com`
  const password = 'StrongPassword123!'

  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Grace Hopper', email: userEmail, password }),
  })
  assert.equal(regRes.status, 201)
  const cookie = regRes.headers.get('set-cookie')?.split(';')[0]
  console.log('✓ Registered test user & received session cookie')

  // 3. Upload Document 1 (Electromagnetism)
  const pdf1 = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 120 >>\nstream\nBT /F1 18 Tf 50 700 Td (Chapter 1: Electromagnetism and Maxwell Equations ${timestamp}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n386\n%%EOF`

  const formData1 = new FormData()
  formData1.append('file', new Blob([pdf1], { type: 'application/pdf' }), `electromagnetism_${timestamp}.pdf`)

  const upload1Res = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: 'POST',
    headers: { cookie },
    body: formData1,
  })
  assert.equal(upload1Res.status, 201)
  const doc1Data = await upload1Res.json()
  const doc1Id = doc1Data.document.id
  console.log(`✓ Uploaded Document 1 (ID: ${doc1Id})`)

  // Upload Document 2 (Thermodynamics)
  const pdf2 = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 120 >>\nstream\nBT /F1 18 Tf 50 700 Td (Chapter 1: Thermodynamics and Entropy ${timestamp}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n386\n%%EOF`

  const formData2 = new FormData()
  formData2.append('file', new Blob([pdf2], { type: 'application/pdf' }), `thermodynamics_${timestamp}.pdf`)

  const upload2Res = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: 'POST',
    headers: { cookie },
    body: formData2,
  })
  assert.equal(upload2Res.status, 201)
  const doc2Data = await upload2Res.json()
  const doc2Id = doc2Data.document.id
  console.log(`✓ Uploaded Document 2 (ID: ${doc2Id})`)

  // Pre-seed learning workspace for Doc 1
  await fetch(`${BASE_URL}/api/learning/${doc1Id}`, { headers: { cookie } })

  // 4. Test Conversational Greeting: "Hi"
  const hiRes = await fetch(`${BASE_URL}/api/voice-agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ message: 'Hi' }),
  })
  assert.equal(hiRes.status, 200)
  const hiData = await hiRes.json()
  assert.ok(hiData.reply.includes('Hi! How can I help you today?'))
  console.log(`✓ Voice Greeting: "${hiData.reply}"`)

  // 5. Test Navigation: "Open my documents"
  const openDocsRes = await fetch(`${BASE_URL}/api/voice-agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ message: 'Open my documents' }),
  })
  assert.equal(openDocsRes.status, 200)
  const openDocsData = await openDocsRes.json()
  assert.equal(openDocsData.action?.type, 'NAVIGATE')
  assert.equal(openDocsData.action?.path, '/app/papers')
  console.log(`✓ Voice Navigation [Open Documents]: "${openDocsData.reply}" -> ${openDocsData.action.path}`)

  // 6. Test Ordinal Document Opening: "Open my second PDF"
  const secondPdfRes = await fetch(`${BASE_URL}/api/voice-agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ message: 'Open my second PDF' }),
  })
  assert.equal(secondPdfRes.status, 200)
  const secondPdfData = await secondPdfRes.json()
  assert.equal(secondPdfData.action?.type, 'NAVIGATE')
  assert.ok(secondPdfData.action?.path.includes('/app/papers/'))
  console.log(`✓ Voice Navigation [Open 2nd PDF]: "${secondPdfData.reply}" -> ${secondPdfData.action.path}`)

  // 7. Test Topic Explanation: "Explain the first topic"
  const explainRes = await fetch(`${BASE_URL}/api/voice-agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      message: 'Explain the first topic',
      context: { documentId: doc1Id },
    }),
  })
  assert.equal(explainRes.status, 200)
  const explainData = await explainRes.json()
  assert.ok(explainData.reply.length > 0)
  console.log(`✓ Voice Explanation [First Topic]: "${explainData.reply.slice(0, 80)}..."`)

  // 8. Test Follow-up: "I don't understand"
  const simplerRes = await fetch(`${BASE_URL}/api/voice-agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      message: "I don't understand",
      context: { documentId: doc1Id },
    }),
  })
  assert.equal(simplerRes.status, 200)
  const simplerData = await simplerRes.json()
  assert.ok(simplerData.reply.includes('easier example') || simplerData.reply.includes('No problem'))
  console.log(`✓ Voice Follow-up [Simpler Example]: "${simplerData.reply.slice(0, 80)}..."`)

  // 9. Test Assessment Trigger: "Give me a test"
  const testRes = await fetch(`${BASE_URL}/api/voice-agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      message: 'Give me a test',
      context: { documentId: doc1Id },
    }),
  })
  assert.equal(testRes.status, 200)
  const testData = await testRes.json()
  assert.equal(testData.action?.type, 'NAVIGATE')
  assert.equal(testData.action?.path, `/app/papers/${doc1Id}/test`)
  console.log(`✓ Voice Navigation [Start Test]: "${testData.reply}" -> ${testData.action.path}`)

  // 10. Test Weak Topics Trigger: "Open weak topics"
  const weakNavRes = await fetch(`${BASE_URL}/api/voice-agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      message: 'Open weak topics',
      context: { documentId: doc1Id },
    }),
  })
  assert.equal(weakNavRes.status, 200)
  const weakNavData = await weakNavRes.json()
  assert.equal(weakNavData.action?.type, 'NAVIGATE')
  assert.equal(weakNavData.action?.path, `/app/papers/${doc1Id}/adaptive`)
  console.log(`✓ Voice Navigation [Weak Topics]: "${weakNavData.reply}" -> ${weakNavData.action.path}`)

  // 11. Test Dashboard Trigger: "Open dashboard"
  const dashRes = await fetch(`${BASE_URL}/api/voice-agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ message: 'Open dashboard' }),
  })
  assert.equal(dashRes.status, 200)
  const dashData = await dashRes.json()
  assert.equal(dashData.action?.type, 'NAVIGATE')
  assert.equal(dashData.action?.path, '/app')
  console.log(`✓ Voice Navigation [Dashboard]: "${dashData.reply}" -> ${dashData.action.path}`)

  console.log('\n======================================================')
  console.log('✅ ALL PHASE 10 CRITERIA MET AND FULLY VERIFIED END-TO-END!')
  console.log('======================================================')
}

runE2E().catch((err) => {
  console.error('❌ E2E Verification Failed:', err)
  process.exit(1)
})
