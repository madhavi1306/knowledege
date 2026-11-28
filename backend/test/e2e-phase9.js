import assert from 'node:assert/strict'

const BASE_URL = 'http://localhost:4000'

async function runE2E() {
  console.log('--- Starting Phase 9 Live End-to-End Verification ---')

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/api/health`)
  assert.equal(healthRes.status, 200)
  const health = await healthRes.json()
  console.log('✓ Backend Health:', health)
  assert.ok(health.phase >= 9, 'Backend must report phase: 9 or higher')

  // 2. Register Student User A
  const timestamp = Date.now()
  const userAEmail = `phase9_student_${timestamp}@example.com`
  const password = 'StrongPassword123!'

  const regARes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Katherine Johnson', email: userAEmail, password }),
  })
  assert.equal(regARes.status, 201)
  const cookieA = regARes.headers.get('set-cookie')?.split(';')[0]
  console.log('✓ Registered User A and obtained session cookie')

  // 3. Upload Document 1
  const pdf1 = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 100 >>\nstream\nBT /F1 18 Tf 50 700 Td (Chapter 1: Orbital Mechanics and Gravitation) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n366\n%%EOF'

  const formData1 = new FormData()
  formData1.append('file', new Blob([pdf1], { type: 'application/pdf' }), `orbital_mechanics_${timestamp}.pdf`)

  const upload1Res = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: 'POST',
    headers: { cookie: cookieA },
    body: formData1,
  })
  assert.equal(upload1Res.status, 201)
  const doc1Data = await upload1Res.json()
  const doc1Id = doc1Data.document.id
  console.log(`✓ Uploaded Document 1 (ID: ${doc1Id})`)

  // Upload Document 2 with distinct content
  const pdf2 = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 120 >>\nstream\nBT /F1 18 Tf 50 700 Td (Chapter 1: Astrophysics and Stellar Spectra ${timestamp}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n386\n%%EOF`

  const formData2 = new FormData()
  formData2.append('file', new Blob([pdf2], { type: 'application/pdf' }), `astrophysics_${timestamp}.pdf`)

  const upload2Res = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: 'POST',
    headers: { cookie: cookieA },
    body: formData2,
  })
  assert.equal(upload2Res.status, 201)
  const doc2Data = await upload2Res.json()
  const doc2Id = doc2Data.document.id
  console.log(`✓ Uploaded Document 2 (ID: ${doc2Id})`)

  // 4. Load Workspace & Study Topic on Doc 1
  const workspaceRes = await fetch(`${BASE_URL}/api/learning/${doc1Id}`, {
    headers: { cookie: cookieA },
  })
  assert.equal(workspaceRes.status, 200)
  const workspace = await workspaceRes.json()
  const topic = workspace.topics[0]
  assert.ok(topic, 'Workspace should contain at least 1 topic')

  // Generate material for topic
  const matRes = await fetch(`${BASE_URL}/api/learning/${doc1Id}/topics/${topic.id}`, {
    headers: { cookie: cookieA },
  })
  assert.equal(matRes.status, 200)

  // Mark topic as COMPLETED
  const statusRes = await fetch(`${BASE_URL}/api/learning/${doc1Id}/topics/${topic.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: cookieA },
    body: JSON.stringify({ status: 'COMPLETED' }),
  })
  assert.equal(statusRes.status, 200)
  console.log(`✓ Generated notes and marked topic "${topic.name}" as COMPLETED`)

  // 5. Take an assessment test on Doc 1
  const testLaunchRes = await fetch(`${BASE_URL}/api/assessments/${doc1Id}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieA },
    body: JSON.stringify({
      scope: 'TOPIC',
      topicId: topic.id,
      difficulty: 'MEDIUM',
      questionCount: 3,
    }),
  })
  assert.equal(testLaunchRes.status, 201)
  const sessionData = await testLaunchRes.json()
  const session = sessionData.session

  // Submit test with answers (1 correct, 2 wrong -> 33.3% WEAK topic)
  const answers = {}
  answers[session.questions[0].id] = session.questions[0].options?.[0] || 'orbital trajectory'
  for (let i = 1; i < session.questions.length; i++) {
    answers[session.questions[i].id] = 'INCORRECT_ANSWER'
  }

  const submitTestRes = await fetch(`${BASE_URL}/api/assessments/sessions/${session.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieA },
    body: JSON.stringify({ answers }),
  })
  assert.equal(submitTestRes.status, 200)
  const testResult = await submitTestRes.json()
  console.log(`✓ Submitted assessment test. Score: ${testResult.results.scorePercentage}%`)

  // 6. Adaptive revision and retest (Phase 8)
  const weakRes = await fetch(`${BASE_URL}/api/adaptive/${doc1Id}/weak-topics`, {
    headers: { cookie: cookieA },
  })
  assert.equal(weakRes.status, 200)
  const weakData = await weakRes.json()
  assert.ok(weakData.weakTopics.length > 0)
  const weakRecord = weakData.weakTopics[0]

  // Launch retest
  const retestLaunchRes = await fetch(`${BASE_URL}/api/adaptive/records/${weakRecord.id}/retest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieA },
    body: JSON.stringify({ questionCount: 2 }),
  })
  assert.equal(retestLaunchRes.status, 201)
  const retestSessionData = await retestLaunchRes.json()
  const retestSession = retestSessionData.session

  // Submit retest with answers
  const retestAnswers = {}
  for (const q of retestSession.retestQuestions) {
    retestAnswers[q.id] = q.options ? q.options[0] : 'True'
  }
  const retestSubmitRes = await fetch(`${BASE_URL}/api/adaptive/sessions/${retestSession.id}/retest-submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieA },
    body: JSON.stringify({ answers: retestAnswers }),
  })
  assert.equal(retestSubmitRes.status, 200)
  const retestResult = await retestSubmitRes.json()
  console.log(`✓ Adaptive retest completed. Improvement delta: ${retestResult.results.improvementDelta >= 0 ? '+' : ''}${retestResult.results.improvementDelta}%`)

  // 7. Track a real learning event via API
  const eventRes = await fetch(`${BASE_URL}/api/analytics/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieA },
    body: JSON.stringify({
      documentId: doc1Id,
      eventType: 'TOPIC_VIEWED',
      title: `Viewed topic "${topic.name}" in learning workspace`,
      details: { timestamp: new Date().toISOString() },
    }),
  })
  assert.equal(eventRes.status, 201)
  console.log('✓ Successfully tracked learning activity event via /api/analytics/events')

  // 8. Test GET /api/analytics/dashboard
  const dashRes = await fetch(`${BASE_URL}/api/analytics/dashboard`, {
    headers: { cookie: cookieA },
  })
  assert.equal(dashRes.status, 200)
  const dashboard = await dashRes.json()
  console.log('✓ Fetched live Dashboard Analytics:')
  console.log('  - Total Documents:', dashboard.summary.totalDocuments)
  console.log('  - Documents Studied:', dashboard.summary.documentsStudied)
  console.log('  - Topics Completed:', dashboard.summary.topicsCompleted)
  console.log('  - Overall Learning Progress:', dashboard.summary.overallLearningProgress + '%')
  console.log('  - Average Test Score:', dashboard.summary.testPerformance.averageScore + '%')
  console.log('  - Weak Topics Count:', dashboard.summary.weakTopics)
  console.log('  - Revision History entries:', dashboard.analytics.revisionHistory.length)

  // Verify dashboard calculations
  assert.equal(dashboard.summary.totalDocuments, 2, 'Should report 2 total uploaded documents')
  assert.equal(dashboard.summary.documentsStudied, 1, 'Should report 1 document studied')
  assert.ok(dashboard.summary.topicsCompleted >= 1, 'Should report at least 1 topic completed')
  assert.ok(dashboard.summary.overallLearningProgress > 0, 'Overall progress should be > 0%')
  assert.equal(dashboard.summary.testPerformance.totalTestsAttempted, 1, 'Should record 1 test attempt')
  assert.ok(dashboard.documentProgress.length >= 2, 'Should include per-document progress for both documents')

  // Verify per-document progress
  const doc1Progress = dashboard.documentProgress.find(d => d.documentId === doc1Id)
  assert.ok(doc1Progress, 'Document 1 progress must exist')
  assert.ok(doc1Progress.topicsCompleted >= 1)
  assert.equal(doc1Progress.testsAttempted, 1)

  // Verify topic progress with transparent completion criteria
  assert.ok(dashboard.topicProgress.length > 0, 'Should track topics')
  const trackedTopic = dashboard.topicProgress.find(t => t.documentId === doc1Id)
  assert.ok(trackedTopic.completionCriteria.length > 0, 'Must provide transparent completion criteria')
  console.log(`  - Transparent Completion Criteria: "${trackedTopic.completionCriteria}"`)

  // Verify analytics charts data
  assert.equal(dashboard.analytics.testPerformance.length, 1, 'Test score trend should have 1 point')
  assert.ok(dashboard.analytics.learningActivityOverTime.length === 7, 'Activity over time must have 7 days')
  assert.ok(dashboard.recentActivity.length > 0, 'Recent activity feed must not be empty')

  // 9. Test GET /api/analytics/documents/:documentId
  const docDetailRes = await fetch(`${BASE_URL}/api/analytics/documents/${doc1Id}`, {
    headers: { cookie: cookieA },
  })
  assert.equal(docDetailRes.status, 200)
  const docDetail = await docDetailRes.json()
  assert.equal(docDetail.document.id, doc1Id)
  assert.ok(docDetail.topics.length > 0)
  console.log('✓ Successfully retrieved single document progress analytics')

  // 10. Strict User Isolation Verification
  const userBEmail = `phase9_isolated_${timestamp}@example.com`
  const regBRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Albert Einstein', email: userBEmail, password }),
  })
  const cookieB = regBRes.headers.get('set-cookie')?.split(';')[0]

  const dashBRes = await fetch(`${BASE_URL}/api/analytics/dashboard`, {
    headers: { cookie: cookieB },
  })
  const dashB = await dashBRes.json()
  assert.equal(dashB.summary.totalDocuments, 0, 'New user B must see 0 documents')
  assert.equal(dashB.summary.topicsCompleted, 0, 'New user B must see 0 completed topics')
  assert.equal(dashB.summary.overallLearningProgress, 0, 'New user B must see 0% overall progress')
  assert.equal(dashB.documentProgress.length, 0, 'New user B must have 0 document progress entries')
  console.log('✓ Verified strict tenant isolation: User B data is completely isolated from User A')

  console.log('\n======================================================')
  console.log('✅ ALL PHASE 9 CRITERIA MET AND FULLY VERIFIED END-TO-END!')
  console.log('======================================================')
}

runE2E().catch((err) => {
  console.error('❌ E2E Verification Failed:', err)
  process.exit(1)
})
