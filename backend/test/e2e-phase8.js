import assert from 'node:assert/strict'

const BASE_URL = 'http://localhost:4000'

async function runE2E() {
  console.log('--- Starting Phase 8 Live End-to-End Verification ---')

  // 1. Check health
  const healthRes = await fetch(`${BASE_URL}/api/health`)
  assert.equal(healthRes.status, 200, 'Health check should return 200')
  const health = await healthRes.json()
  console.log('✓ Backend Health:', health)
  assert.ok(health.phase >= 8, 'Backend should report phase: 8 or higher')

  // 2. Register a unique user
  const timestamp = Date.now()
  const email = `phase8_student_${timestamp}@example.com`
  const password = 'StrongPassword123!'
  
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ada Lovelace',
      email,
      password,
    }),
  })
  assert.equal(regRes.status, 201, 'Registration should return 201')
  const cookie = regRes.headers.get('set-cookie')?.split(';')[0]
  console.log('✓ Registered test user & received session cookie')

  // 3. Upload a sample document
  const samplePdfContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 120 >>\nstream\nBT\n/F1 18 Tf\n50 700 Td\n(Chapter 1: Neural Networks and Backpropagation) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n386\n%%EOF'

  const formData = new FormData()
  const blob = new Blob([samplePdfContent], { type: 'application/pdf' })
  formData.append('file', blob, `deep_learning_${timestamp}.pdf`)

  const uploadRes = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: 'POST',
    headers: { cookie },
    body: formData,
  })
  assert.equal(uploadRes.status, 201, 'Upload should return 201')
  const uploadData = await uploadRes.json()
  const documentId = uploadData.document.id
  console.log(`✓ Uploaded test PDF document (ID: ${documentId})`)

  // 4. Generate structured learning workspace (Phase 4)
  const learnWorkspaceRes = await fetch(`${BASE_URL}/api/learning/${documentId}`, {
    headers: { cookie },
  })
  assert.equal(learnWorkspaceRes.status, 200)
  const learnWorkspace = await learnWorkspaceRes.json()
  const topic = learnWorkspace.topics[0]
  const topicId = topic.id
  console.log(`✓ Loaded learning workspace with topic "${topic.name}" (ID: ${topicId})`)

  // 5. Generate a test on this topic (Phase 7)
  const testLaunchRes = await fetch(`${BASE_URL}/api/assessments/${documentId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      scope: 'TOPIC',
      topicId,
      difficulty: 'MEDIUM',
      questionCount: 3,
    }),
  })
  assert.equal(testLaunchRes.status, 201)
  const testSessionData = await testLaunchRes.json()
  const testSession = testSessionData.session
  console.log(`✓ Launched assessment test with ${testSession.questions.length} questions`)

  // Ensure answers are hidden before submission
  assert.equal(testSession.questions[0].correctAnswer, undefined, 'Correct answers must remain hidden during test')

  // 6. Submit intentional wrong answers to trigger weak topic detection
  const wrongAnswers = {}
  for (const q of testSession.questions) {
    wrongAnswers[q.id] = 'DEFINITELY_INCORRECT_STUDENT_ANSWER'
  }

  const submitRes = await fetch(`${BASE_URL}/api/assessments/sessions/${testSession.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ answers: wrongAnswers }),
  })
  assert.equal(submitRes.status, 200)
  const submitData = await submitRes.json()
  console.log(`✓ Submitted test with intentional wrong answers. Score: ${submitData.results.scorePercentage}%`)
  assert.equal(submitData.results.scorePercentage, 0)
  assert.equal(submitData.results.topicPerformance[0].status, 'WEAK')

  // 7. Check Phase 8 Weak Topics endpoint
  const weakTopicsRes = await fetch(`${BASE_URL}/api/adaptive/${documentId}/weak-topics`, {
    headers: { cookie },
  })
  assert.equal(weakTopicsRes.status, 200)
  const weakTopicsData = await weakTopicsRes.json()
  console.log(`✓ Phase 8 Weak Topics Detected: ${weakTopicsData.weakTopics.length} topic(s)`)
  assert.ok(weakTopicsData.weakTopics.length > 0, 'Should detect at least 1 weak topic')
  
  const weakRecord = weakTopicsData.weakTopics[0]
  console.log(`  Topic: "${weakRecord.topicName}", Status: ${weakRecord.status}, Score: ${weakRecord.currentScore}%, Reason: "${weakRecord.detectionReason}"`)
  assert.equal(weakRecord.status, 'NEEDS_REVISION')
  assert.ok(weakRecord.detectionReason.length > 0)
  assert.ok(weakRecord.incorrectAnswersHistory.length > 0)

  // 8. Fetch Adaptive Reteach
  const reteachRes = await fetch(`${BASE_URL}/api/adaptive/records/${weakRecord.id}/reteach`, {
    headers: { cookie },
  })
  assert.equal(reteachRes.status, 200)
  const reteachData = await reteachRes.json()
  const reteach = reteachData.adaptiveReteach
  console.log(`✓ Phase 8 Adaptive Reteach Generated:`)
  console.log(`  - Gap Analysis: "${reteach.gapAnalysis?.slice(0, 50)}..."`)
  console.log(`  - Simplified Explanation: "${reteach.simplifiedExplanation?.slice(0, 50)}..."`)
  console.log(`  - Micro Steps: ${reteach.microSteps?.length} steps`)
  console.log(`  - Different Analogy: "${reteach.differentAnalogy?.title}"`)
  console.log(`  - Mermaid Diagram: ${reteach.simplifiedDiagram?.slice(0, 30)}...`)
  console.log(`  - Practice Checks: ${reteach.practiceQuestions?.length} questions`)

  assert.ok(reteach.microSteps.length >= 2, 'Should have micro-steps')
  assert.ok(reteach.simplifiedExplanation.length > 0, 'Should have simplified explanation')
  assert.ok(reteach.differentAnalogy.title.length > 0, 'Should have alternate analogy')
  assert.ok(reteach.simplifiedDiagram.includes('graph') || reteach.simplifiedDiagram.includes('flowchart'))

  // 9. Generate Adaptive Retest (avoiding duplicate questions)
  const retestLaunchRes = await fetch(`${BASE_URL}/api/adaptive/records/${weakRecord.id}/retest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ questionCount: 2 }),
  })
  assert.equal(retestLaunchRes.status, 201)
  const retestData = await retestLaunchRes.json()
  const retestSession = retestData.session
  const questions = retestSession.retestQuestions
  console.log(`✓ Phase 8 Retest Generated with ${questions.length} fresh questions (Session ID: ${retestSession.id})`)
  
  // 10. Submit Retest with answers
  const retestAnswers = {}
  for (const q of questions) {
    if (q.type === 'TRUE_FALSE') {
      retestAnswers[q.id] = 'True'
    } else if (q.options && q.options.length > 0) {
      retestAnswers[q.id] = q.options[0]
    } else {
      retestAnswers[q.id] = 'concept mechanism'
    }
  }

  const retestSubmitRes = await fetch(`${BASE_URL}/api/adaptive/sessions/${retestSession.id}/retest-submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ answers: retestAnswers }),
  })
  assert.equal(retestSubmitRes.status, 200)
  const retestResult = await retestSubmitRes.json()
  console.log(`✓ Retest Submitted. Results:`)
  console.log(`  - Retest Score: ${retestResult.results.retestScore}%`)
  console.log(`  - Previous Score: ${retestResult.results.previousScore}%`)
  console.log(`  - Improvement Delta: ${retestResult.results.improvementDelta >= 0 ? '+' : ''}${retestResult.results.improvementDelta}%`)
  console.log(`  - Topic Status: ${retestResult.weakTopicRecord.status}`)

  // 11. Verify Weak Topics status is updated
  const updatedWeakTopicsRes = await fetch(`${BASE_URL}/api/adaptive/${documentId}/weak-topics`, {
    headers: { cookie },
  })
  const updatedWeakData = await updatedWeakTopicsRes.json()
  const updatedRecord = updatedWeakData.weakTopics.find(r => r.id === weakRecord.id)
  console.log(`✓ Verified updated status in Weak Topics List: ${updatedRecord.status}`)
  assert.ok(['RETESTED', 'RESOLVED', 'IMPROVING', 'REPEATED_DIFFICULTY'].includes(updatedRecord.status))

  console.log('\n======================================================')
  console.log('✅ ALL PHASE 8 CRITERIA MET AND FULLY VERIFIED END-TO-END!')
  console.log('======================================================')
}

runE2E().catch((err) => {
  console.error('❌ E2E Verification Failed:', err)
  process.exit(1)
})
