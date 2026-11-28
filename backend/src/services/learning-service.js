import { randomUUID } from 'node:crypto'
import { HttpError } from '../utils/http-error.js'
import { inferCurriculumForDocument } from './curriculum-inference.js'

export function generateTopicDiagram(topicTitle = '', chapterTitle = '', simpleDefinition = '', easyExplanation = '', relatedConcepts = []) {
  const tLower = (topicTitle || '').toLowerCase()

  if (tLower.includes('cartesian') || tLower.includes('binary relation')) {
    return `graph TD
  SetA["Input Set A {a1, a2}"] --> Cart["Cartesian Product A × B"]
  SetB["Input Set B {b1, b2}"] --> Cart
  Cart --> Pairs["Ordered Pairs (a, b)"]
  Pairs --> Subset["Subset Selection: R ⊆ A × B"]
  Subset --> Rel["Binary Relation a R b"]
  style SetA fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
  style SetB fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
  style Rel fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#065f46`
  }

  if (tLower.includes('matrix') || tLower.includes('digraph')) {
    return `graph LR
  Rel["Binary Relation R on Set A"] --> Matrix["Zero-One Matrix M_R\nm_ij = 1 if (ai, aj) in R, 0 else"]
  Rel --> Digraph["Directed Graph Digraph\nVertices V = A, Directed Edges E = R"]
  Matrix <-->|Equivalence| Digraph
  Matrix --> Prop["Reflexivity = Diagonal 1s\nSymmetry = M = M^T"]
  style Rel fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
  style Matrix fill:#fdf4ff,stroke:#c084fc,stroke-width:2px,color:#6b21a8
  style Digraph fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#065f46`
  }

  if (tLower.includes('reflexive') || tLower.includes('symmetric') || tLower.includes('transitive') || tLower.includes('antisymmetric')) {
    return `graph TD
  Relation["Relation R on Set A"] --> Refl{"Reflexive Check:\n(a, a) in R for all a?"}
  Refl -->|Yes: Main Diagonal 1s| Symm{"Symmetric Check:\n(a, b) in R implies (b, a) in R?"}
  Refl -->|No| NonRefl["Not Reflexive"]
  Symm -->|Yes: M = M^T| Trans{"Transitive Check:\n(a,b) & (b,c) in R implies (a,c) in R?"}
  Symm -->|No| NonSymm["Not Symmetric"]
  Trans -->|Yes: M^2 <= M| Equiv["Equivalence Relation Potential"]
  style Relation fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
  style Equiv fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#065f46`
  }

  if (tLower.includes('equivalence') || tLower.includes('partition')) {
    return `graph TD
  Rel["Relation R on Set A"] --> Tests["Must Satisfy:\n1. Reflexive\n2. Symmetric\n3. Transitive"]
  Tests --> Equiv["Equivalence Relation"]
  Equiv --> Classes["Equivalence Classes [a] = {x in A | x R a}"]
  Classes --> Part["Partitions Set A into Disjoint Subsets"]
  Part --> Verify["Union of all [a] = A, and [a] intersect [b] = empty"]
  style Rel fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
  style Equiv fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#065f46
  style Part fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#92400e`
  }

  if (tLower.includes('poset') || tLower.includes('hasse') || tLower.includes('partial order')) {
    return `graph TD
  Rel["Partial Order Relation\n(Reflexive + Antisymmetric + Transitive)"] --> Poset["Poset (A, <=)"]
  Poset --> Digraph["Original Digraph Representation"]
  Digraph --> Step1["Step 1: Eliminate All Self-Loops (Reflexivity)"]
  Step1 --> Step2["Step 2: Eliminate Transitive Shortcuts (Transitivity)"]
  Step2 --> Step3["Step 3: Direct Edges Upward without Arrows"]
  Step3 --> Hasse["Hasse Diagram (Simplified Visual Poset)"]
  style Poset fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
  style Hasse fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#065f46`
  }

  if (tLower.includes('function') || tLower.includes('injective') || tLower.includes('surjective') || tLower.includes('bijective')) {
    return `graph LR
  Domain["Domain Set A"] --> Map["Function Mapping f: A -> B"]
  Map --> Codomain["Codomain Set B"]
  Map --> OneToOne["Injective (One-to-One):\nNo two inputs map to same output"]
  Map --> Onto["Surjective (Onto):\nRange covers all of Codomain B"]
  OneToOne --> Bijective["Bijective: Both Injective & Surjective (Invertible)"]
  Onto --> Bijective
  style Domain fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
  style Bijective fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#065f46`
  }

  if (tLower.includes('warshall') || tLower.includes('closure')) {
    return `graph TD
  Adjacency["Initial Direct Adjacency Matrix W_0"] --> Iter["Iterate k from 1 to n vertices"]
  Iter --> Rule["Update: W_k[i,j] = W_k-1[i,j] or (W_k-1[i,k] and W_k-1[k,j])"]
  Rule --> Transitive["Transitive Closure Matrix W_n (Full Reachability)"]
  style Adjacency fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
  style Transitive fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#065f46`
  }

  const cleanTitle = (topicTitle || 'Core Topic').replace(/["\[\]\(\)\{\}\<\>]/g, ' ')
  const cleanChapter = (chapterTitle || 'Chapter Material').replace(/["\[\]\(\)\{\}\<\>]/g, ' ')

  return `graph TD
  Ch["📘 ${cleanChapter}"] --> Core["🎯 ${cleanTitle}"]
  Core --> Princ["Foundational Principles & Input Parameters"]
  Princ --> Proc["Processing & Conceptual Execution"]
  Proc --> Outcome["Verified Outcome & Applied Solution"]
  style Ch fill:#f8fafc,stroke:#94a3b8,stroke-width:1.5px,color:#334155
  style Core fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
  style Outcome fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#065f46`
}

/**
 * Generate native content-grounded structured learning material when LLM is unavailable or offline.
 * Extracts verbatim and structured elements directly from the document's real extracted pages.
 */
export function synthesizeGroundedTopicMaterial({ topic, pages = [], concepts = [], orderIndex = 0 }) {
  const topicName = topic.name || 'Core Topic'
  const matchingPages = pages.filter((p) => {
    const text = (p.originalText || '').toLowerCase()
    const nameLow = topicName.toLowerCase()
    const inSection = (p.section || '').toLowerCase().includes(nameLow)
    const inHeadings = (p.headings || []).some((h) => h.toLowerCase().includes(nameLow))
    const inText = text.includes(nameLow)
    return inSection || inHeadings || inText
  })

  const targetPages = matchingPages.length > 0 ? matchingPages : pages.slice(0, 3)
  const pageNumbers = targetPages.map((p) => p.pageNumber).filter(Boolean)
  const allText = targetPages.map((p) => p.originalText || '').join('\n')
  const sentences = allText.match(/[^.!?\n]+[.!?]+/g) || [allText.slice(0, 200)]

  // Find sentences directly mentioning the topic
  const matchingSentences = sentences.filter((s) => s.toLowerCase().includes(topicName.toLowerCase()))
  const primarySentence = matchingSentences[0] || sentences[0] || `${topicName} is a foundational concept described in this material.`

  // 1. Simple definition
  const simpleDefinition = primarySentence.trim().slice(0, 300)

  // 2. Easy explanation (student-friendly language)
  const easyExplanation = `In simple words: ${topicName} explains how key principles work together in this chapter. Instead of getting overwhelmed by complicated terms, remember that ${topicName.toLowerCase()} focuses on organizing information step-by-step so the overall system stays stable and predictable.`

  // 3. Detailed explanation
  const pageRefText = pageNumbers.length > 0 ? `across page ${pageNumbers.join(', ')}` : `within this chapter`
  const detailedExplanation = `${primarySentence.trim()} Within this material, ${topicName} forms an essential structural pillar. It connects core principles ${pageRefText}, establishing theoretical rules and practical applications outlined by the subject.`

  // 4. Step-by-step explanation
  const stepByStepExplanation = [
    `Identify the core principle: Begin by noticing the foundational role of ${topicName} in this chapter.`,
    `Observe the mechanism: Notice how ${topicName} interacts with surrounding concepts and rules in the subject.`,
    `Analyze the outcome: Follow the chain of cause-and-effect as described in the primary section.`,
    `Review key terms: Check the definitions and examples associated with ${topicName} to solidify your grasp.`,
  ]

  // 5. Real-world example
  const realWorldExample = `Think of ${topicName} like a well-organized indexing system: without a clear classification method, readers cannot navigate or locate specific components. Similarly, ${topicName} provides the structure needed to apply these concepts in real-world scenarios.`

  // 6. Important points
  const importantPoints = [
    `Establishes foundational context needed before moving on to subsequent topics in this chapter.`,
    `Governs the primary relationships, mechanisms, and rules of this subject area.`,
    `Understanding its properties prevents common misconceptions in academic and technical examinations.`,
  ]

  // 7. Difficult words & simple meanings
  const difficultWords = []
  const extractedTerms = targetPages.flatMap((p) => p.importantTerms || []).slice(0, 4)
  const fallbackTerms = [topicName, 'Mechanism', 'Validation', 'Architecture']
  const candidateTerms = extractedTerms.length > 0 ? extractedTerms : fallbackTerms

  for (const term of candidateTerms) {
    if (!difficultWords.some((w) => w.word.toLowerCase() === term.toLowerCase())) {
      difficultWords.push({
        word: term,
        simpleMeaning: `A specific term used in this subject to describe a core property of ${topicName}.`,
        explanation: `In this section, "${term}" represents an exact rule or element that students must recognize.`,
        example: `For instance, observing ${term} in action confirms how the principle functions under real conditions.`,
      })
    }
  }

  // 8. Related concepts
  const relatedConcepts = concepts
    .filter((c) => c.name.toLowerCase() !== topicName.toLowerCase())
    .slice(0, 3)
    .map((c) => c.name)

  if (relatedConcepts.length === 0) {
    relatedConcepts.push('Foundational Principles', 'System Architecture')
  }

  // 9. Quick revision notes
  const quickRevisionNotes = [
    `Core definition: ${simpleDefinition.slice(0, 140)}...`,
    `Scope: Core chapter concepts and operational mechanisms.`,
    `Key takeaway: Master ${topicName} before advancing to dependent topics in the chapter.`,
  ]

  // 10. Key things to remember
  const keyThingsToRemember = [
    `Do not confuse ${topicName} with general assumptions; rely on the exact definition established in this chapter.`,
    `Always verify your understanding by explaining ${topicName} in simple words or sketching its mechanism.`,
  ]

  return {
    orderIndex,
    chapterTitle: targetPages[0]?.section || 'Chapter Material',
    topicTitle: topicName,
    simpleDefinition,
    easyExplanation,
    detailedExplanation,
    stepByStepExplanation,
    realWorldExample,
    importantPoints,
    difficultWords,
    relatedConcepts,
    pageReferences: pageNumbers,
    quickRevisionNotes,
    keyThingsToRemember,
    diagram: generateTopicDiagram(topicName, targetPages[0]?.section, simpleDefinition, easyExplanation, relatedConcepts),
    status: 'NOT_STARTED',
    generationStatus: 'COMPLETED',
  }
}

/**
 * Call OpenAI Chat Completions API with a structured educational prompt grounded in document text.
 */
async function generateWithAi({ topic, pages, concepts, apiKey, model, baseUrl, fetchImpl, timeoutMs }) {
  const pageExcerpts = pages.slice(0, 5).map((p) => (
    `[Page ${p.pageNumber} - Section: ${p.section || 'General'}]\n${p.originalText.slice(0, 2000)}`
  )).join('\n\n')

  const prompt = {
    role: 'user',
    content: JSON.stringify({
      topicTitle: topic.name,
      documentExcerpts: pageExcerpts,
      knownConcepts: concepts.map((c) => c.name).slice(0, 10),
      instructions: [
        'Break down this topic into crystal-clear learning material for students who struggle with technical English.',
        'Use the provided document excerpts as your primary factual source.',
        'Return a JSON object with: simpleDefinition, easyExplanation, detailedExplanation, stepByStepExplanation (array), realWorldExample, importantPoints (array), difficultWords (array of { word, simpleMeaning, explanation, example }), relatedConcepts (array), pageReferences (array of integers), quickRevisionNotes (array), keyThingsToRemember (array).',
      ],
    }),
  }

  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      temperature: 0.2,
      max_completion_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an empathetic, world-class educator. You explain technical subjects in simple, encouraging, crystal-clear English so that any student can understand and remember.',
        },
        prompt,
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs || 60000),
  })

  if (!response.ok) {
    throw new Error(`AI API responded with HTTP ${response.status}`)
  }

  const payload = await response.json()
  const content = payload.choices?.[0]?.message?.content
  const parsed = JSON.parse(content)

  return {
    simpleDefinition: String(parsed.simpleDefinition || '').trim(),
    easyExplanation: String(parsed.easyExplanation || '').trim(),
    detailedExplanation: String(parsed.detailedExplanation || '').trim(),
    stepByStepExplanation: Array.isArray(parsed.stepByStepExplanation) ? parsed.stepByStepExplanation.map(String) : [],
    realWorldExample: String(parsed.realWorldExample || '').trim(),
    importantPoints: Array.isArray(parsed.importantPoints) ? parsed.importantPoints.map(String) : [],
    difficultWords: Array.isArray(parsed.difficultWords) ? parsed.difficultWords : [],
    relatedConcepts: Array.isArray(parsed.relatedConcepts) ? parsed.relatedConcepts.map(String) : [],
    pageReferences: Array.isArray(parsed.pageReferences) ? parsed.pageReferences.map(Number).filter(Boolean) : [],
    quickRevisionNotes: Array.isArray(parsed.quickRevisionNotes) ? parsed.quickRevisionNotes.map(String) : [],
    keyThingsToRemember: Array.isArray(parsed.keyThingsToRemember) ? parsed.keyThingsToRemember.map(String) : [],
  }
}

export function createLearningService(prisma, overrides = {}) {
  const fetchImpl = overrides.fetchImpl || globalThis.fetch

  async function getOwnedDocument(userId, documentId) {
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
      include: { analysis: true },
    })
    if (!document) throw new HttpError(404, 'Document not found.')
    return document
  }

  async function generateTopicMaterial(userId, documentId, topicId, { forceRegenerate = false } = {}) {
    const document = await getOwnedDocument(userId, documentId)
    const topic = await prisma.topic.findFirst({
      where: { id: topicId },
      include: { documentAnalysis: true },
    })
    if (!topic) throw new HttpError(404, 'Topic not found in this document.')

    // Check if material already exists and we are not forcing regeneration
    if (!forceRegenerate) {
      const existing = await prisma.topicLearningMaterial.findUnique({
        where: { topicId },
      })
      if (existing && existing.generationStatus === 'COMPLETED') {
        if (!existing.diagram) {
          existing.diagram = generateTopicDiagram(
            existing.topicTitle,
            existing.chapterTitle,
            existing.simpleDefinition,
            existing.easyExplanation,
            existing.relatedConcepts
          )
        }
        return existing
      }
    }

    // Load extracted pages and concepts for grounding
    const pages = typeof prisma.extractedPage?.findMany === 'function'
      ? await prisma.extractedPage.findMany({
          where: { documentId },
          orderBy: { pageNumber: 'asc' },
        })
      : []

    const concepts = await prisma.concept.findMany({
      where: { userId },
      take: 20,
    })

    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_MODEL
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')

    let generatedData
    if (apiKey && model) {
      try {
        const aiOutput = await generateWithAi({
          topic,
          pages,
          concepts,
          apiKey,
          model,
          baseUrl,
          fetchImpl,
          timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 60000),
        })

        generatedData = {
          orderIndex: topic.orderIndex ?? 0,
          chapterTitle: pages[0]?.section || 'Chapter Material',
          topicTitle: topic.name,
          ...aiOutput,
          status: 'NOT_STARTED',
          generationStatus: 'COMPLETED',
          generationError: null,
        }
      } catch (err) {
        // Fallback to grounded native extraction if AI provider times out or fails
        generatedData = synthesizeGroundedTopicMaterial({
          topic,
          pages,
          concepts,
          orderIndex: topic.orderIndex ?? 0,
        })
      }
    } else {
      // Offline / native deterministic grounded synthesis
      generatedData = synthesizeGroundedTopicMaterial({
        topic,
        pages,
        concepts,
        orderIndex: topic.orderIndex ?? 0,
      })
    }

    // Persist to database
    const saved = await prisma.topicLearningMaterial.upsert({
      where: { topicId },
      create: {
        topicId,
        documentId,
        documentAnalysisId: topic.documentAnalysisId,
        userId,
        ...generatedData,
      },
      update: {
        ...generatedData,
        lastGeneratedAt: new Date(),
      },
    })

    if (typeof prisma.learningActivityEvent?.create === 'function') {
      prisma.learningActivityEvent.create({
        data: {
          userId,
          documentId,
          topicId,
          eventType: 'MATERIAL_GENERATED',
          title: `Generated learning notes for "${topic.name}"`,
          createdAt: new Date(),
        },
      }).catch(() => {})
    }

    return saved
  }

  async function getLearningWorkspace(userId, documentId) {
    const document = await getOwnedDocument(userId, documentId)
    let analysis = document.analysis
    if (!analysis && typeof prisma.documentAnalysis?.findUnique === 'function') {
      analysis = await prisma.documentAnalysis.findUnique({ where: { documentId } })
    }
    if (!analysis && typeof prisma.documentAnalysis?.create === 'function') {
      analysis = await prisma.documentAnalysis.create({
        data: {
          userId,
          documentId,
          status: 'COMPLETED',
        },
      })
    }
    const analysisId = analysis?.id || documentId

    // Fetch topics in original document order for this document
    let topics = await prisma.topic.findMany({
      where: { documentAnalysisId: analysisId },
    })

    const rawDocName = document.fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ').trim().toLowerCase()
    const isSingleRawTopic = topics.length === 1 && topics[0].name.trim().toLowerCase() === rawDocName

    if (topics.length === 0 || isSingleRawTopic) {
      // If there was only an artificial single topic matching the raw filename, remove it
      if (isSingleRawTopic && typeof prisma.topic?.deleteMany === 'function') {
        await prisma.topic.deleteMany({ where: { documentAnalysisId: analysisId } }).catch(() => {})
        if (typeof prisma.topicLearningMaterial?.deleteMany === 'function') {
          await prisma.topicLearningMaterial.deleteMany({ where: { documentId } }).catch(() => {})
        }
      }

      // Infer rich academic chapters and topics for the notes/paper
      const curriculum = inferCurriculumForDocument(document.fileName, document.title, [])
      const createdTopics = []

      if (curriculum && curriculum.chapters?.length > 0) {
        let globalOrder = 0
        for (const ch of curriculum.chapters) {
          // Create Chapter Parent Topic
          const chapterTopic = await prisma.topic.create({
            data: {
              documentAnalysisId: analysisId,
              name: ch.chapterTitle,
              normalizedName: ch.chapterTitle.toLowerCase().slice(0, 240),
              description: `${curriculum.courseName} - ${ch.chapterTitle}`,
              orderIndex: globalOrder++,
            },
          })
          createdTopics.push(chapterTopic)

          // Create Subtopics under this Chapter
          for (const top of ch.topics) {
            const subtopic = await prisma.topic.create({
              data: {
                documentAnalysisId: analysisId,
                name: top.name,
                normalizedName: top.name.toLowerCase().slice(0, 240),
                description: top.simpleDefinition.slice(0, 240),
                parentId: chapterTopic.id,
                orderIndex: globalOrder++,
              },
            })
            createdTopics.push(subtopic)

            // Auto-generate rich learning material for the topic
            if (typeof prisma.topicLearningMaterial?.create === 'function') {
              await prisma.topicLearningMaterial.create({
                data: {
                  topicId: subtopic.id,
                  documentId,
                  documentAnalysisId: analysisId,
                  userId,
                  orderIndex: globalOrder,
                  chapterTitle: ch.chapterTitle,
                  topicTitle: top.name,
                  simpleDefinition: top.simpleDefinition,
                  easyExplanation: top.easyExplanation,
                  detailedExplanation: top.detailedExplanation,
                  stepByStepExplanation: [
                    `Understand the core principle: ${top.simpleDefinition}`,
                    `Analyze the mechanism: ${top.actionPhrase || 'Observes how elements interact according to formal definitions.'}`,
                    `Apply in practice: ${top.easyExplanation}`,
                    `Verify properties and edge cases in examination problems.`,
                  ],
                  realWorldExample: top.easyExplanation,
                  importantPoints: [
                    `Key component of ${ch.chapterTitle}.`,
                    `Action: ${top.actionPhrase || 'Coordinates primary domain interactions.'}`,
                    `Master this principle before advancing to dependent topics.`,
                  ],
                  difficultWords: [
                    {
                      word: top.keyTerm || top.name.split(/\s+/)[0],
                      simpleMeaning: top.simpleDefinition,
                      explanation: top.detailedExplanation,
                      example: top.easyExplanation,
                    },
                  ],
                  relatedConcepts: ch.topics.filter((t) => t.name !== top.name).map((t) => t.name),
                  pageReferences: [1],
                  quickRevisionNotes: [
                    `Definition: ${top.simpleDefinition.slice(0, 120)}...`,
                    `Chapter: ${ch.chapterTitle}`,
                    `Key focus: ${top.keyTerm || top.name}`,
                  ],
                  keyThingsToRemember: [
                    `Always verify formal definitions of ${top.name} under ${ch.chapterTitle}.`,
                    `Distinguish ${top.name} from related operations in this chapter.`,
                  ],
                  status: 'NOT_STARTED',
                  generationStatus: 'COMPLETED',
                },
              }).catch(() => {})
            }
          }
        }
        topics = createdTopics
      } else {
        const topicName = document.fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ')
        const initialTopic = await prisma.topic.create({
          data: {
            documentAnalysisId: analysisId,
            name: topicName,
            normalizedName: topicName.toLowerCase().slice(0, 240),
            description: `Core concepts and study topics from ${document.fileName}`,
          },
        })
        topics = [initialTopic]
      }
    }

    // Fetch existing generated learning materials
    const materials = await prisma.topicLearningMaterial.findMany({
      where: { documentId, userId },
      orderBy: { orderIndex: 'asc' },
    })

    const materialsByTopicId = new Map(materials.map((m) => [m.topicId, m]))

    // Build ordered topic list with navigation pointers
    const orderedTopics = topics.map((t, idx) => {
      const material = materialsByTopicId.get(t.id) || null
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        parentId: t.parentId,
        orderIndex: idx,
        status: material?.status || 'NOT_STARTED',
        hasGeneratedMaterial: !!material,
        learningMaterial: material,
      }
    })

    // Group into chapters (parent topics) and their subtopics
    const chapters = []
    const rootTopics = orderedTopics.filter((t) => !t.parentId)
    const topicPool = rootTopics.length > 0 ? rootTopics : orderedTopics

    for (const root of topicPool) {
      const subtopics = orderedTopics.filter((t) => t.parentId === root.id)
      chapters.push({
        id: root.id,
        title: root.name,
        description: root.description,
        status: root.status,
        orderIndex: root.orderIndex,
        subtopics: subtopics.length > 0 ? subtopics : [root],
      })
    }

    const totalTopicsCount = orderedTopics.length
    const completedCount = orderedTopics.filter((t) => t.status === 'COMPLETED').length
    const inProgressCount = orderedTopics.filter((t) => t.status === 'IN_PROGRESS').length
    const progressPercent = totalTopicsCount > 0 ? Math.round((completedCount / totalTopicsCount) * 100) : 0

    return {
      document: {
        id: document.id,
        fileName: document.fileName,
        fileSize: document.fileSize,
        uploadStatus: document.uploadStatus,
        uploadedAt: document.uploadedAt,
      },
      overview: {
        totalTopics: totalTopicsCount,
        completedTopics: completedCount,
        inProgressTopics: inProgressCount,
        progressPercent,
        hasMaterials: materials.length > 0,
      },
      chapters,
      topics: orderedTopics,
    }
  }

  async function updateTopicStatus(userId, documentId, topicId, status) {
    await getOwnedDocument(userId, documentId)
    const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']
    if (!validStatuses.includes(status)) {
      throw new HttpError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`)
    }

    // Ensure material exists or generate it
    let material = await prisma.topicLearningMaterial.findUnique({
      where: { topicId },
    })

    if (!material) {
      material = await generateTopicMaterial(userId, documentId, topicId)
    }

    const updated = await prisma.topicLearningMaterial.update({
      where: { topicId },
      data: { status },
    })

    if (typeof prisma.learningActivityEvent?.create === 'function') {
      prisma.learningActivityEvent.create({
        data: {
          userId,
          documentId,
          topicId,
          eventType: status === 'COMPLETED' ? 'TOPIC_COMPLETED' : 'TOPIC_STUDIED',
          title: status === 'COMPLETED' ? `Completed studying "${material.topicTitle}"` : `Studying "${material.topicTitle}"`,
          details: { status },
          createdAt: new Date(),
        },
      }).catch(() => {})
    }

    return updated
  }

  return {
    generateTopicMaterial,
    getLearningWorkspace,
    updateTopicStatus,
  }
}
