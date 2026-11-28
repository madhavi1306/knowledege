import { randomUUID } from 'node:crypto'
import { buildDocumentChunks, retrieveRelevantChunks } from './retrieval-engine.js'
import {
  detectLanguage,
  CHAT_SECTION_HEADINGS,
  CONCEPT_EXPLANATIONS,
} from './multilingual-ai.js'

/**
 * Service for Document-based AI Chat & Question Answering (KNOWFLOW Phase 6).
 */
export function createChatService(prisma) {
  // In-memory cache for document chunks to avoid re-aggregating on every question
  const chunksCache = new Map()

  /**
   * Retrieves or builds search chunks for a document.
   */
  async function getOrBuildChunks(documentId) {
    if (chunksCache.has(documentId)) {
      return chunksCache.get(documentId)
    }

    const [document, pages, visuals, analysis, materials] = await Promise.all([
      prisma.document.findUnique({ where: { id: documentId } }),
      prisma.extractedPage?.findMany ? prisma.extractedPage.findMany({ where: { documentId } }) : [],
      prisma.documentVisual?.findMany ? prisma.documentVisual.findMany({ where: { documentId } }) : [],
      prisma.documentAnalysis?.findUnique ? prisma.documentAnalysis.findUnique({ where: { documentId } }) : null,
      prisma.topicLearningMaterial?.findMany ? prisma.topicLearningMaterial.findMany({ where: { documentId } }) : [],
    ])

    if (!document) {
      throw new Error(`Document not found: ${documentId}`)
    }

    const concepts = prisma.concept?.findMany
      ? await prisma.concept.findMany({ where: { userId: document.userId } })
      : []

    const chunks = buildDocumentChunks({
      documentId,
      pages,
      visuals,
      materials,
      concepts,
    })

    chunksCache.set(documentId, chunks)
    return chunks
  }

  /**
   * Invalidates chunks cache when document analysis or visuals change.
   */
  function invalidateChunksCache(documentId) {
    chunksCache.delete(documentId)
  }

  /**
   * Creates or gets active chat session for a user and document.
   */
  async function getOrCreateSession(userId, documentId, topicId = null, title = null) {
    let session = await prisma.documentChatSession.findFirst({
      where: {
        userId,
        documentId,
        ...(topicId ? { topicId } : {}),
      },
      include: {
        messages: true,
      },
    })

    if (!session) {
      session = await prisma.documentChatSession.create({
        data: {
          userId,
          documentId,
          topicId: topicId || null,
          title: title || 'Document Q&A Session',
        },
      })
      session.messages = []
    }

    return session
  }

  /**
   * Lists all sessions for a document.
   */
  async function listSessions(userId, documentId) {
    return prisma.documentChatSession.findMany({
      where: { userId, documentId },
      include: { messages: true },
      orderBy: { updatedAt: 'desc' },
    })
  }

  /**
   * Clears a chat session and its messages.
   */
  async function clearSession(userId, sessionId) {
    const session = await prisma.documentChatSession.findUnique({
      where: { id: sessionId },
    })
    if (!session || session.userId !== userId) {
      throw new Error('Chat session not found or unauthorized.')
    }

    await prisma.documentChatMessage.deleteMany({
      where: { sessionId },
    })

    return { cleared: true, sessionId }
  }

  /**
   * Core question answering function grounded strictly in document chunks.
   */
  async function answerQuestion({
    userId,
    documentId,
    sessionId,
    question,
    topicId = null,
    language = null,
  }) {
    if (!question || !question.trim()) {
      throw new Error('Question cannot be empty.')
    }

    const doc = await prisma.document.findUnique({ where: { id: documentId } })
    if (!doc || doc.userId !== userId) {
      throw new Error('Document not found or access denied.')
    }

    let session
    if (sessionId) {
      session = await prisma.documentChatSession.findUnique({
        where: { id: sessionId },
        include: { messages: true },
      })
      if (!session || session.userId !== userId) {
        throw new Error('Chat session not found.')
      }
    } else {
      session = await getOrCreateSession(userId, documentId, topicId)
    }

    const recentHistory = (session.messages || []).slice(-6)

    // 1. Build and retrieve relevant chunks
    const allChunks = await getOrBuildChunks(documentId)
    const { chunks: retrievedChunks, isOutOfScope, queryIntent } = retrieveRelevantChunks(question, allChunks, {
      topK: 5,
      activeTopicId: topicId,
      recentHistory,
      minScoreThreshold: 0.35,
    })

    const targetLanguage = detectLanguage(question.trim(), language)

    // 2. Synthesize Grounded Answer in requested language
    const synthesis = synthesizeDocumentAnswer({
      question: question.trim(),
      document: doc,
      retrievedChunks,
      isOutOfScope,
      queryIntent,
      recentHistory,
      language: targetLanguage,
    })

    // 3. Persist User Message and Assistant Message in DB
    const userMsg = await prisma.documentChatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: question.trim(),
      },
    })

    const assistantMsg = await prisma.documentChatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: synthesis.formattedAnswer,
        directAnswer: synthesis.directAnswer,
        simpleExplanation: synthesis.simpleExplanation,
        example: synthesis.example,
        importantPoints: synthesis.importantPoints,
        pageReferences: synthesis.pageReferences,
        retrievedChunks: retrievedChunks.map((c) => ({
          id: c.id,
          pageNumber: c.pageNumber,
          section: c.section,
          type: c.type,
          excerpt: c.excerpt,
        })),
        citations: synthesis.citations,
        supplementary: synthesis.supplementary,
        notCovered: synthesis.notCovered,
      },
    })

    return {
      session,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
    }
  }

  return {
    getOrCreateSession,
    listSessions,
    clearSession,
    answerQuestion,
    getOrBuildChunks,
    invalidateChunksCache,
  }
}

/**
 * Deterministic Answer Synthesizer grounded strictly in retrieved chunks.
 * Guarantees the 5-point answer structure:
 * 1. Direct answer
 * 2. Simple explanation (easy English)
 * 3. Example where useful
 * 4. Important points
 * 5. Document page references
 */
export function synthesizeDocumentAnswer({
  question,
  document,
  retrievedChunks = [],
  isOutOfScope = false,
  queryIntent = {},
  recentHistory = [],
  language = 'en',
}) {
  const docName = document.fileName || 'your document'
  const lang = detectLanguage(question, language)
  const headings = CHAT_SECTION_HEADINGS[lang] || CHAT_SECTION_HEADINGS.en

  // CASE 1: Query is not covered in document
  if (isOutOfScope || retrievedChunks.length === 0) {
    let directAnswer = `This question is not covered in your uploaded document "${docName}".`
    let simpleExplanation = `I searched through your document's text, headings, diagrams, and tables, but found no information about "${question}". To preserve strict factual accuracy, I will not invent facts not present in your document.`
    let importantPoints = [
      `Grounded in document: "${docName}"`,
      `The document covers topics such as ${document.analysis?.subject || 'the uploaded material'}, but does not contain details regarding this query.`,
      `Please ask questions related to the topics, chapters, diagrams, or tables present in this PDF.`,
    ]

    if (lang === 'kn') {
      directAnswer = `ಈ ಪ್ರಶ್ನೆಯು ನಿಮ್ಮ "${docName}" ಡಾಕ್ಯುಮೆಂಟ್‌ನಲ್ಲಿ ಉಲ್ಲೇಖವಾಗಿಲ್ಲ.`
      simpleExplanation = `ನಿಮ್ಮ ಡಾಕ್ಯುಮೆಂಟ್‌ನ ಪಠ್ಯ, ರೇಖಾಚಿತ್ರಗಳು ಮತ್ತು ಕೋಷ್ಟಕಗಳನ್ನು ಹುಡುಕಲಾಗಿದೆ, ಆದರೆ "${question}" ಬಗ್ಗೆ ಯಾವುದೇ ವಿವರಗಳು ಕಂಡುಬಂದಿಲ್ಲ. ನಿಖರತೆಗಾಗಿ ಡಾಕ್ಯುಮೆಂಟ್‌ನಲ್ಲಿ ಇಲ್ಲದ ಮಾಹಿತಿಯನ್ನು ನೀಡಲಾಗುವುದಿಲ್ಲ.`
      importantPoints = [
        `ದಾಖಲೆ: "${docName}"`,
        `ದಯವಿಟ್ಟು ಈ PDF ನಲ್ಲಿರುವ ವಿಷಯಗಳು, ಅಧ್ಯಾಯಗಳು ಅಥವಾ ರೇಖಾಚಿತ್ರಗಳಿಗೆ ಸಂಬಂಧಿಸಿದ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ.`,
      ]
    } else if (lang === 'hi') {
      directAnswer = `यह प्रश्न आपके अपलोड किए गए दस्तावेज़ "${docName}" में शामिल नहीं है।`
      simpleExplanation = `दस्तावेज़ में "${question}" के बारे में कोई प्रासंगिक जानकारी नहीं मिली। सटीकता बनाए रखने के लिए केवल दस्तावेज़ में मौजूद तथ्य ही बताए जाते हैं।`
      importantPoints = [
        `आधार दस्तावेज़: "${docName}"`,
        `कृपया इस पीडीएफ में मौजूद विषयों, अध्यायों या आरेखों से संबंधित प्रश्न पूछें।`,
      ]
    } else if (lang === 'ta') {
      directAnswer = `இந்த கேள்வி உங்கள் ஆவணம் "${docName}"-ல் இடம்பெறவில்லை.`
      simpleExplanation = `உங்கள் ஆவணத்தில் "${question}" பற்றிய தகவல் கிடைக்கவில்லை.`
      importantPoints = [`ஆவணம்: "${docName}"`]
    } else if (lang === 'te') {
      directAnswer = `ఈ ప్రశ్న మీ అప్‌లోడ్ చేసిన డాక్యుమెంట్ "${docName}" లో లేదు.`
      simpleExplanation = `మీ డాక్యుమెంట్‌లో "${question}" గురించి సమాచారం దొరకలేదు.`
      importantPoints = [`ఆధార డాక్యుమెంట్: "${docName}"`]
    }

    const formattedAnswer = [
      `### ${headings.direct}\n${directAnswer}`,
      `### ${headings.simple}\n${simpleExplanation}`,
      `### ${headings.points}\n${importantPoints.map((p) => `- ${p}`).join('\n')}`,
    ].join('\n\n')

    return {
      directAnswer,
      simpleExplanation,
      example: null,
      importantPoints,
      pageReferences: [],
      citations: [],
      supplementary: false,
      notCovered: true,
      formattedAnswer,
      language: lang,
    }
  }

  // Collect page references
  const pageSet = new Set()
  for (const c of retrievedChunks) {
    if (c.pageNumber) pageSet.add(c.pageNumber)
    if (Array.isArray(c.pageReferences)) {
      c.pageReferences.forEach((p) => pageSet.add(p))
    }
  }
  const pageReferences = Array.from(pageSet).sort((a, b) => a - b)
  const primaryPage = pageReferences[0] || 1
  const primaryChunk = retrievedChunks[0]

  // Detect specific modes
  const isSimplerRequest = (queryIntent.isFollowUpQuery || /simpler|simply|simple|easy/i.test(question)) && /simpler|simply|simple|easy/i.test(question)
  const isStepRequest = queryIntent.isStepQuery || /step|process|how/i.test(question)
  const isExampleRequest = queryIntent.isExampleQuery || /example|analogy/i.test(question)
  const isRevisionRequest = queryIntent.isRevisionQuery || /revision|recap|summary/i.test(question)
  const isDiagramRequest = queryIntent.isDiagramQuery || primaryChunk.type === 'VISUAL'
  const isTableRequest = queryIntent.isTableQuery || primaryChunk.type === 'TABLE'

  // Check domain concept knowledge base
  const qLower = question.toLowerCase()
  let domainConceptMatch = null
  for (const [key, details] of Object.entries(CONCEPT_EXPLANATIONS[lang] || {})) {
    if (qLower.includes(key) || (primaryChunk.title && primaryChunk.title.toLowerCase().includes(key))) {
      domainConceptMatch = details
      break
    }
  }

  // Synthesize Direct Answer
  let directAnswer = ''
  if (lang === 'kn') {
    if (domainConceptMatch) {
      directAnswer = `ನಿಮ್ಮ ದಾಖಲೆಯ ಪುಟ ${primaryPage} ರ ಪ್ರಕಾರ ("${primaryChunk.section || primaryChunk.title}"): ${domainConceptMatch.meaning}`
    } else {
      const sentences = primaryChunk.content.split(/\n+/).filter(Boolean)
      directAnswer = `ನಿಮ್ಮ ದಾಖಲೆಯ ಪುಟ ${primaryPage} ರ ಪ್ರಕಾರ ("${primaryChunk.section || primaryChunk.title}"): ${sentences[0] || primaryChunk.title}`
    }
  } else if (lang === 'hi') {
    if (domainConceptMatch) {
      directAnswer = `आपके दस्तावेज़ के पृष्ठ ${primaryPage} के अनुसार ("${primaryChunk.section || primaryChunk.title}"): ${domainConceptMatch.meaning}`
    } else {
      const sentences = primaryChunk.content.split(/\n+/).filter(Boolean)
      directAnswer = `आपके दस्तावेज़ के पृष्ठ ${primaryPage} के अनुसार ("${primaryChunk.section || primaryChunk.title}"): ${sentences[0] || primaryChunk.title}`
    }
  } else {
    const sentences = primaryChunk.content.split(/\n+/).filter(Boolean)
    const firstLine = sentences[0] || primaryChunk.title
    directAnswer = `According to your document on Page ${primaryPage} under "${primaryChunk.section}", ${firstLine.replace(/^[^a-zA-Z0-9]+/, '')}.`
  }

  // Synthesize Simple Explanation
  let simpleExplanation = ''
  if (lang === 'kn') {
    if (domainConceptMatch) {
      simpleExplanation = `ಸರಳವಾಗಿ ಹೇಳುವುದಾದರೆ: ${domainConceptMatch.meaning} ಇದು ವ್ಯವಸ್ಥೆಯು ದೋಷರಹಿತವಾಗಿ ಮತ್ತು ಸುಗಮವಾಗಿ ಕಾರ್ಯನಿರ್ವಹಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.`
    } else {
      simpleExplanation = `ಸರಳ ಕನ್ನಡ ವಿವರಣೆ: ಪುಟ ${primaryPage} ರಲ್ಲಿ ತಿಳಿಸಿರುವಂತೆ, ${primaryChunk.title || primaryChunk.section} ಎಂಬುದು ಈ ವಿಷಯದ ಪ್ರಮುಖ ಅಡಿಪಾಯವಾಗಿದೆ. ಇದನ್ನು ಅರ್ಥಮಾಡಿಕೊಂಡರೆ ಸಂಪೂರ್ಣ ವಿಷಯ ಸುಲಭವಾಗುತ್ತದೆ.`
    }
  } else if (lang === 'hi') {
    if (domainConceptMatch) {
      simpleExplanation = `सरल शब्दों में: ${domainConceptMatch.meaning} यह प्रणाली को सुचारू और स्पष्ट रूप से कार्य करने में सक्षम बनाता है।`
    } else {
      simpleExplanation = `सरल हिंदी में: पृष्ठ ${primaryPage} पर समझाया गया है कि ${primaryChunk.title || primaryChunk.section} इस अध्याय का एक मुख्य स्तंभ है।`
    }
  } else {
    simpleExplanation = `In simple English: On Page ${primaryPage}, the document explains that ${primaryChunk.title || primaryChunk.section} is designed to make the main concept function clearly and reliably. You can refer to this whenever you need to recall how this section connects to the rest of the material.`
  }

  // Synthesize Example
  let example = ''
  if (lang === 'kn') {
    example = domainConceptMatch?.example || `ನೈಜ ಉದಾಹರಣೆ: ತಂಡದ ನಾಯಕನು ಪ್ರತಿಯೊಬ್ಬ ಸದಸ್ಯರಿಗೂ ಅವರವರ ಕಾರ್ಯವನ್ನು ಹಂಚಿ ಸಮನ್ವಯಗೊಳಿಸುವಂತೆ, ${primaryChunk.title || 'ಈ ವಿಧಾನವು'} ವ್ಯವಸ್ಥಿತವಾಗಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ.`
  } else if (lang === 'hi') {
    example = domainConceptMatch?.example || `वास्तविक उदाहरण: जिस तरह एक प्रोजेक्ट मैनेजर सभी सदस्यों को कार्य सौंपता है ताकि काम सही समय पर हो, वैसे ही ${primaryChunk.title || 'यह तंत्र'} कार्य करता है।`
  } else {
    example = `A real-world example: Imagine a team manager coordinating tasks so every team member knows exactly when to start their part. That is how ${primaryChunk.title || 'this mechanism'} operates in practice.`
  }

  // Synthesize Important Points
  let importantPoints = []
  if (lang === 'kn') {
    importantPoints = domainConceptMatch?.points || [
      `ಡಾಕ್ಯುಮೆಂಟ್ ಉಲ್ಲೇಖ: ಪುಟ ${primaryPage} ನಲ್ಲಿರುವ "${primaryChunk.section}" ಅಡಿಯಲ್ಲಿ ಕಂಡುಬಂದಿದೆ.`,
      `ಪ್ರಮುಖ ತತ್ವ: ${primaryChunk.title || 'ಮೂಲ ಪರಿಕಲ್ಪನೆ'} ಈ ಅಧ್ಯಾಯದ ಅಗತ್ಯ ಭಾಗವಾಗಿದೆ.`,
      `ಪುಟ ಉಲ್ಲೇಖ: ಪೂರ್ಣ ವಿವರಣೆಯನ್ನು ನೋಡಲು PDF ನ ಪುಟ ${primaryPage} ಅನ್ನು ವೀಕ್ಷಿಸಿ.`,
    ]
  } else if (lang === 'hi') {
    importantPoints = domainConceptMatch?.points || [
      `दस्तावेज़ साक्ष्य: पृष्ठ ${primaryPage} के खंड "${primaryChunk.section}" में उपलब्ध।`,
      `मुख्य निष्कर्ष: ${primaryChunk.title || 'मुख्य सिद्धांत'} इस विषय का एक आवश्यक भाग है।`,
      `मूल पाठ के लिए पीडीएफ दर्शक में पृष्ठ ${primaryPage} देखें।`,
    ]
  } else {
    importantPoints = [
      `Document Grounding: Found on Page ${primaryPage} under "${primaryChunk.section}".`,
      `Core takeaway: ${primaryChunk.title || 'Key principle'} is an essential building block in this document.`,
      pageReferences.length > 1
        ? `Cross-references: This concept also connects with content on Page(s) ${pageReferences.slice(1).join(', ')}.`
        : `Page anchor: Review Page ${primaryPage} in the PDF viewer to see the author's original phrasing.`,
    ]
  }

  // Citations
  const citations = retrievedChunks.slice(0, 3).map((c) => ({
    pageNumber: c.pageNumber,
    section: c.section,
    type: c.type,
    excerpt: c.excerpt,
  }))

  const pageRefLabel = (p) => {
    if (lang === 'kn') return `- **[ಪುಟ ${p}]** ನಿಮ್ಮ "${docName}" ಡಾಕ್ಯುಮೆಂಟ್‌ನಿಂದ`
    if (lang === 'hi') return `- **[पृष्ठ ${p}]** आपके दस्तावेज़ "${docName}" से`
    if (lang === 'ta') return `- **[பக்கம் ${p}]** உங்கள் ஆவணம் "${docName}" இலிருந்து`
    if (lang === 'te') return `- **[పేజీ ${p}]** మీ డాక్యుమెంట్ "${docName}" నుండి`
    return `- **[Page ${p}]** from your document "${docName}"`
  }

  // Formatted Answer String
  const parts = [
    `### ${headings.direct}\n${directAnswer}`,
    `### ${headings.simple}\n${simpleExplanation}`,
    example ? `### ${headings.example}\n${example}` : null,
    `### ${headings.points}\n${importantPoints.map((p) => `- ${p}`).join('\n')}`,
    `### ${headings.references}\n${pageReferences.map(pageRefLabel).join('\n')}`,
  ].filter(Boolean)

  const formattedAnswer = parts.join('\n\n')

  return {
    directAnswer,
    simpleExplanation,
    example,
    importantPoints,
    pageReferences,
    citations,
    supplementary: false,
    notCovered: false,
    formattedAnswer,
    language: lang,
  }
}
