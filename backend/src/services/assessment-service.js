import { randomUUID } from 'node:crypto'
import { inferCurriculumForDocument } from './curriculum-inference.js'

/**
 * Assessment Engine for KNOWFLOW Phase 7.
 * Generates and evaluates topic, chapter, and document-wide tests grounded in actual document content.
 */

export function createAssessmentService(prisma) {
  /**
   * Generates a topic, chapter, or document test.
   */
  async function generateTest({
    userId,
    documentId,
    scope = 'DOCUMENT', // 'TOPIC', 'CHAPTER', 'DOCUMENT'
    topicId = null,
    chapterTitle = null,
    difficulty = 'MEDIUM', // 'EASY', 'MEDIUM', 'HARD'
    questionCount = 5,
  }) {
    const document = await prisma.document.findUnique({ where: { id: documentId } })
    if (!document || document.userId !== userId) {
      throw new Error('Document not found or access denied.')
    }

    // 1. Gather all document data
    const [pages, materials, visuals, analysis] = await Promise.all([
      prisma.extractedPage?.findMany ? prisma.extractedPage.findMany({ where: { documentId } }) : [],
      prisma.topicLearningMaterial?.findMany ? prisma.topicLearningMaterial.findMany({ where: { documentId } }) : [],
      prisma.documentVisual?.findMany ? prisma.documentVisual.findMany({ where: { documentId } }) : [],
      prisma.documentAnalysis?.findUnique ? prisma.documentAnalysis.findUnique({ where: { documentId } }) : null,
    ])

    // 2. Filter content pool by scope
    let filteredMaterials = [...materials]
    let filteredPages = [...pages]
    let filteredVisuals = [...visuals]
    let targetTopicName = null

    if (scope === 'TOPIC' && topicId) {
      filteredMaterials = materials.filter((m) => m.topicId === topicId || m.id === topicId)
      if (filteredMaterials[0]) {
        targetTopicName = filteredMaterials[0].topicTitle
        const pageRefs = new Set(filteredMaterials[0].pageReferences || [])
        if (pageRefs.size > 0) {
          filteredPages = pages.filter((p) => pageRefs.has(p.pageNumber))
          filteredVisuals = visuals.filter((v) => pageRefs.has(v.pageNumber))
        }
      }
    } else if (scope === 'CHAPTER' && chapterTitle) {
      filteredMaterials = materials.filter((m) => (m.chapterTitle || '').toLowerCase() === chapterTitle.toLowerCase())
      filteredPages = pages.filter((p) => (p.section || '').toLowerCase().includes(chapterTitle.toLowerCase()))
    }

    // 3. Synthesize questions grounded in the content
    const rawQuestions = synthesizeQuestionsFromContent({
      document,
      pages: filteredPages.length ? filteredPages : pages,
      materials: filteredMaterials.length ? filteredMaterials : materials,
      visuals: filteredVisuals.length ? filteredVisuals : visuals,
      scope,
      difficulty,
      targetCount: Math.min(Math.max(Number(questionCount) || 5, 3), 20),
      topicName: targetTopicName,
    })

    // 4. Create the QuizSession & QuizQuestions in DB
    const session = await prisma.quizSession.create({
      data: {
        userId,
        documentId,
        scope,
        topicId: topicId || null,
        topicName: targetTopicName || (scope === 'CHAPTER' ? chapterTitle : 'All Document Topics'),
        chapterTitle: chapterTitle || null,
        mode: scope,
        difficulty,
        totalQuestions: rawQuestions.length,
        completed: false,
        questions: {
          create: rawQuestions.map((q) => ({
            conceptName: q.topicName || q.conceptName || 'Core Concept',
            topicName: q.topicName || 'General',
            pageNumber: q.pageNumber || 1,
            questionText: q.questionText,
            type: q.type,
            difficulty: q.difficulty,
            options: q.options || [],
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            documentExcerpt: q.documentExcerpt || null,
          })),
        },
      },
    })

    // Fetch the created questions
    const questions = await prisma.quizQuestion.findMany({
      where: { quizSessionId: session.id },
    })

    // Return session with questions, HIDING correct answers before submission!
    return {
      session: {
        ...session,
        questions: questions.map((q) => sanitizeQuestionForStudent(q)),
      },
    }
  }

  /**
   * Retrieves an existing test session.
   * If not completed, hides correct answers.
   */
  async function getTest(userId, sessionId) {
    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
    })
    if (!session || session.userId !== userId) {
      throw new Error('Test session not found or unauthorized.')
    }

    const questions = await prisma.quizQuestion.findMany({
      where: { quizSessionId: sessionId },
    })

    return {
      session: {
        ...session,
        questions: session.completed
          ? questions
          : questions.map((q) => sanitizeQuestionForStudent(q)),
      },
    }
  }

  /**
   * Submits an assessment, evaluates answers, calculates scores and topic performance.
   */
  async function submitTest({ userId, sessionId, answers = {} }) {
    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
    })
    if (!session || session.userId !== userId) {
      throw new Error('Test session not found.')
    }

    const questions = await prisma.quizQuestion.findMany({
      where: { quizSessionId: sessionId },
    })

    // Normalize answers format: support array [{questionId, answer}] or map {id: answer}
    const answerMap = {}
    if (Array.isArray(answers)) {
      for (const a of answers) {
        if (a.questionId) answerMap[a.questionId] = a.answer
      }
    } else if (typeof answers === 'object' && answers !== null) {
      Object.assign(answerMap, answers)
    }

    let correctCount = 0
    let incorrectCount = 0
    const topicStats = new Map()
    const evaluatedQuestions = []

    for (const q of questions) {
      const studentAns = (answerMap[q.id] || '').trim()
      const isCorrect = evaluateQuestionAnswer(q, studentAns)

      if (isCorrect) correctCount++
      else incorrectCount++

      // Track topic performance
      const topic = q.topicName || 'General Topic'
      if (!topicStats.has(topic)) {
        topicStats.set(topic, { total: 0, correct: 0 })
      }
      const tStat = topicStats.get(topic)
      tStat.total++
      if (isCorrect) tStat.correct++

      // Update question in DB
      await prisma.quizQuestion.update({
        where: { id: q.id },
        data: {
          userAnswer: studentAns,
          isCorrect,
        },
      })

      evaluatedQuestions.push({
        ...q,
        userAnswer: studentAns,
        isCorrect,
      })
    }

    const totalQuestions = questions.length
    const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 1000) / 10 : 0

    // Build topic performance breakdown
    const topicPerformance = []
    const strongConcepts = []
    const weakConcepts = []

    for (const [topic, stats] of topicStats.entries()) {
      const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
      const status = pct >= 80 ? 'STRONG' : pct >= 50 ? 'IMPROVING' : 'WEAK'
      if (status === 'STRONG') strongConcepts.push(topic)
      else if (status === 'WEAK') weakConcepts.push(topic)

      topicPerformance.push({
        topicName: topic,
        totalQuestions: stats.total,
        correctCount: stats.correct,
        scorePercentage: pct,
        status,
      })
    }

    // Update QuizSession in DB
    const updatedSession = await prisma.quizSession.update({
      where: { id: sessionId },
      data: {
        completed: true,
        completedAt: new Date(),
        correctCount,
        incorrectCount,
        scorePercentage,
        topicPerformance,
        strongConceptNames: strongConcepts,
        weakConceptNames: weakConcepts,
      },
    })

    if (typeof prisma.learningActivityEvent?.create === 'function') {
      prisma.learningActivityEvent.create({
        data: {
          userId,
          documentId: session.documentId,
          eventType: 'TEST_COMPLETED',
          title: `Completed assessment with score ${scorePercentage}% (${correctCount}/${totalQuestions})`,
          details: { scorePercentage, correctCount, totalQuestions, weakConcepts },
          createdAt: new Date(),
        },
      }).catch(() => {})
    }

    return {
      session: {
        ...updatedSession,
        questions: evaluatedQuestions,
      },
      results: {
        totalQuestions,
        correctCount,
        incorrectCount,
        scorePercentage,
        topicPerformance,
      },
    }
  }

  /**
   * Retrieves test history for a document and user.
   */
  async function getTestHistory(userId, documentId) {
    const sessions = await prisma.quizSession.findMany({
      where: {
        userId,
        documentId,
        completed: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      history: sessions.map((s) => ({
        id: s.id,
        documentId: s.documentId,
        scope: s.scope,
        topicName: s.topicName,
        difficulty: s.difficulty,
        totalQuestions: s.totalQuestions,
        correctCount: s.correctCount,
        incorrectCount: s.incorrectCount,
        scorePercentage: s.scorePercentage,
        completedAt: s.completedAt || s.updatedAt,
        topicPerformance: s.topicPerformance || [],
      })),
    }
  }

  return {
    generateTest,
    getTest,
    submitTest,
    getTestHistory,
  }
}

/**
 * Hides correct answer and explanation from unsubmitted questions.
 */
function sanitizeQuestionForStudent(q) {
  return {
    id: q.id,
    quizSessionId: q.quizSessionId,
    questionText: q.questionText,
    type: q.type,
    difficulty: q.difficulty,
    options: q.options || [],
    topicName: q.topicName,
    pageNumber: q.pageNumber,
    // Sensitive fields stripped until after submission
    correctAnswer: undefined,
    explanation: undefined,
    documentExcerpt: undefined,
  }
}

/**
 * Evaluates whether a student answer matches the correct answer.
 */
export function evaluateQuestionAnswer(question, studentAnswer) {
  if (!studentAnswer) return false
  const cleanAns = studentAnswer.trim().toLowerCase()
  const cleanCorrect = (question.correctAnswer || '').trim().toLowerCase()

  // 1. Multiple Choice & True/False: exact match or option letter match
  if (question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE') {
    if (cleanAns === cleanCorrect) return true
    // Handle option letter answer (e.g. "A" matching "A) Option text")
    if (cleanCorrect.startsWith(cleanAns + ')') || cleanCorrect.startsWith(cleanAns + '.')) return true
    return false
  }

  // 2. Fill in the blanks: exact keyword match
  if (question.type === 'FILL_IN_BLANKS') {
    return cleanAns === cleanCorrect || cleanCorrect.includes(cleanAns)
  }

  // 3. Short Answer & Concept Based: semantic keyword match
  if (question.type === 'SHORT_ANSWER' || question.type === 'CONCEPT_BASED') {
    const keyWords = cleanCorrect
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
    if (keyWords.length === 0) return cleanAns.length > 3

    let matched = 0
    for (const kw of keyWords) {
      if (cleanAns.includes(kw)) matched++
    }
    // If student mentions at least 40% of the core keywords, credit answer
    return matched / keyWords.length >= 0.4 || cleanAns.includes(cleanCorrect)
  }

  return cleanAns === cleanCorrect
}

/**
 * Synthesizes questions grounded in document content across all 5 test types:
 * - MULTIPLE_CHOICE
 * - TRUE_FALSE
 * - FILL_IN_BLANKS
 * - SHORT_ANSWER
 * - CONCEPT_BASED
 */
export function synthesizeQuestionsFromContent({
  document,
  pages = [],
  materials = [],
  visuals = [],
  scope = 'DOCUMENT',
  difficulty = 'MEDIUM',
  targetCount = 5,
  topicName = null,
}) {
  const questions = []
  const types = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_BLANKS', 'SHORT_ANSWER', 'CONCEPT_BASED']

  // Retrieve rich curriculum inference for the document/notes/paper
  const inferred = inferCurriculumForDocument(document?.fileName || '', document?.title || '', pages)

  // Source item pools
  const pool = []

  for (const m of materials) {
    const isGenericFallback = (m.simpleDefinition || '').includes('is a foundational concept described in this material')
    if (!isGenericFallback) {
      pool.push({
        topic: m.topicTitle,
        chapter: m.chapterTitle || 'Chapter Concepts',
        section: m.chapterTitle || m.topicTitle,
        text: m.simpleDefinition || m.easyExplanation || m.detailedExplanation,
        points: m.importantPoints || [],
        example: m.realWorldExample,
        keyTerm: (m.difficultWords?.[0]?.word) || m.topicTitle.split(/\s+/)[0],
        actionPhrase: 'governs the foundational behavior of this concept',
        distractors: [
          'It completely negates the primary mechanism and suppresses signal propagation.',
          'It operates without adhering to deterministic structural validation rules.',
          'It is applied solely as an unmonitored heuristic without formal guarantees.',
        ],
        page: m.pageReferences?.[0] || 1,
      })
    }
  }

  // If pages have real extracted text
  for (const p of pages) {
    const text = (p.paragraphs?.[0] || p.originalText || '').slice(0, 300)
    if (text && text.trim().length > 30) {
      const topic = p.headings?.[0] || p.section || 'Core Principles'
      pool.push({
        topic,
        chapter: p.section || 'Chapter Material',
        section: p.section || 'Chapter Material',
        text,
        points: p.definitions?.map((d) => (typeof d === 'string' ? d : `${d.term}: ${d.definition}`)) || [],
        keyTerm: p.importantTerms?.[0] || topic.split(/\s+/)[0] || 'Mechanism',
        actionPhrase: 'coordinates core interactions across this section',
        distractors: [
          'It introduces arbitrary stochastic variations without formal convergence criteria.',
          'It excludes all input validation and produces unverified outputs.',
          'It is restricted exclusively to trivial base-case scenarios.',
        ],
        page: p.pageNumber,
      })
    }
  }

  // Visual diagrams
  for (const v of visuals) {
    pool.push({
      topic: v.title,
      chapter: 'Visual Models & Diagrams',
      section: v.title,
      text: v.whatItRepresents || v.purpose,
      points: v.importantPoints || [],
      keyTerm: v.title.split(/\s+/)[0] || 'Visual Model',
      actionPhrase: 'provides a visual representation of structural relationships',
      distractors: [
        'It misrepresents the causal workflow by reversing directional flows.',
        'It is an ornamental chart with zero topological correspondence to the system.',
        'It only illustrates discarded legacy architectures.',
      ],
      page: v.pageNumber,
      isVisual: true,
    })
  }

  // If pool is empty or only had generic text, populate from the rich inferred curriculum!
  if (pool.length === 0 && inferred && inferred.chapters?.length > 0) {
    for (const ch of inferred.chapters) {
      for (const t of ch.topics) {
        pool.push({
          topic: t.name,
          chapter: ch.chapterTitle,
          section: ch.chapterTitle,
          text: t.simpleDefinition,
          points: [t.easyExplanation, t.detailedExplanation],
          example: t.easyExplanation,
          keyTerm: t.keyTerm || t.name.split(/\s+/)[0],
          actionPhrase: t.actionPhrase || 'establishes the core mathematical and technical rule',
          distractors: t.distractors || [
            'It allows arbitrary exceptions without satisfying structural prerequisites.',
            'It acts only as a cosmetic alias with no distinct operational significance.',
            'It is permanently deprecated across all modern standard frameworks.',
          ],
          page: 1,
        })
      }
    }
  }

  // Final fallback
  if (pool.length === 0) {
    const cleanDoc = (document.fileName || 'Subject Material').replace(/\.pdf$/i, '').replace(/[_-]/g, ' ')
    pool.push({
      topic: `${cleanDoc} Principles`,
      chapter: 'Core Chapter Material',
      section: 'Core Chapter Material',
      text: 'The fundamental theoretical and practical principles governing this chapter.',
      points: ['Primary principles govern the domain.', 'Key mechanisms ensure stability.'],
      keyTerm: 'Operational Principle',
      actionPhrase: 'maintains foundational integrity and predictable execution',
      distractors: [
        'It allows unvalidated input propagation without applying system constraints.',
        'It functions as an isolated heuristic with no formal proofs.',
        'It replaces standard algorithms with arbitrary indeterminate lookups.',
      ],
      page: 1,
    })
  }

  let poolIdx = 0

  for (let i = 0; i < targetCount; i++) {
    const item = pool[poolIdx % pool.length]
    poolIdx++

    const qType = types[i % types.length]
    const pageNum = item.page || 1
    const currentTopic = topicName || item.topic
    const chapterName = item.chapter || item.section || 'This Chapter'

    if (qType === 'MULTIPLE_CHOICE') {
      const correctText = item.text.replace(/\n/g, ' ')
      const dist = (item.distractors && item.distractors.length >= 3)
        ? item.distractors
        : [
            'It completely negates the primary mechanism and suppresses all signal propagation.',
            'It operates without adhering to deterministic structural validation rules.',
            'It is applied solely as an unmonitored heuristic without formal guarantees.',
          ]

      questions.push({
        type: 'MULTIPLE_CHOICE',
        difficulty,
        topicName: currentTopic,
        chapterTitle: chapterName,
        pageNumber: pageNum,
        questionText: `In the study of "${currentTopic}" (${chapterName}), which statement accurately defines its core principle?`,
        options: [
          `A) ${correctText}`,
          `B) ${dist[0]}`,
          `C) ${dist[1]}`,
          `D) ${dist[2]}`,
        ],
        correctAnswer: `A) ${correctText}`,
        explanation: `Under ${chapterName}, "${currentTopic}" is defined as: ${correctText}`,
        documentExcerpt: correctText.slice(0, 200),
      })
    } else if (qType === 'TRUE_FALSE') {
      const isTrue = i % 2 === 0
      const statement = isTrue
        ? `In ${chapterName}, "${currentTopic}" is characterized by: ${item.text.slice(0, 180)}`
        : `In ${chapterName}, "${currentTopic}" is completely unnecessary and arbitrarily excluded from all calculations.`

      questions.push({
        type: 'TRUE_FALSE',
        difficulty,
        topicName: currentTopic,
        chapterTitle: chapterName,
        pageNumber: pageNum,
        questionText: `True or False: ${statement}`,
        options: ['True', 'False'],
        correctAnswer: isTrue ? 'True' : 'False',
        explanation: isTrue
          ? `True. In ${chapterName}, "${currentTopic}" establishes that: ${item.text.slice(0, 200)}`
          : `False. In reality, "${currentTopic}" is a core concept defined as: ${item.text.slice(0, 200)}`,
        documentExcerpt: item.text.slice(0, 180),
      })
    } else if (qType === 'FILL_IN_BLANKS') {
      const keyword = item.keyTerm || currentTopic.split(/\s+/)[0] || 'Mechanism'
      const phrase = item.actionPhrase || 'coordinates foundational interactions'

      questions.push({
        type: 'FILL_IN_BLANKS',
        difficulty,
        topicName: currentTopic,
        chapterTitle: chapterName,
        pageNumber: pageNum,
        questionText: `Fill in the blank: Within ${chapterName}, the fundamental concept or property in "${currentTopic}" that ${phrase} is known as "____".`,
        options: [keyword, 'Arbitrary Heuristic', 'Monolithic Boundary', 'Undefined Construct'],
        correctAnswer: keyword,
        explanation: `The correct term is "${keyword}", which is the key mechanism in "${currentTopic}" within ${chapterName}.`,
        documentExcerpt: `${currentTopic}: ${item.text.slice(0, 150)}`,
      })
    } else if (qType === 'SHORT_ANSWER') {
      questions.push({
        type: 'SHORT_ANSWER',
        difficulty,
        topicName: currentTopic,
        chapterTitle: chapterName,
        pageNumber: pageNum,
        questionText: `In 1 or 2 concise sentences, what is the primary role or definition of "${currentTopic}" within ${chapterName}?`,
        options: [],
        correctAnswer: item.text.slice(0, 140),
        explanation: `Within ${chapterName}, "${currentTopic}" is defined as: "${item.text.slice(0, 200)}".`,
        documentExcerpt: item.text.slice(0, 180),
      })
    } else if (qType === 'CONCEPT_BASED') {
      questions.push({
        type: 'CONCEPT_BASED',
        difficulty,
        topicName: currentTopic,
        chapterTitle: chapterName,
        pageNumber: pageNum,
        questionText: `Concept Scenario: When applying the principles of "${currentTopic}" in ${chapterName}, how does this mechanism ensure operational stability and correctness?`,
        options: [],
        correctAnswer: `It enforces structured domain constraints and deterministic rules as established in ${chapterName}.`,
        explanation: `Within ${chapterName}, "${currentTopic}" establishes formal constraints that validate states and prevent inconsistencies.`,
        documentExcerpt: item.text.slice(0, 160),
      })
    }
  }

  return questions
}
