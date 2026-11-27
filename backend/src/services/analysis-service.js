import { documentSettings, createDocumentService } from './document-service.js'
import { createAnalysisAi } from './analysis-ai.js'
import { extractPdfPages } from './pdf-extractor.js'
import { HttpError } from '../utils/http-error.js'

const DEFAULT_CHUNK_CHARACTERS = 12000
const MAX_PENDING_JOBS = 100

export function normalizeAnalysisName(value) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function uniqueStrings(values) {
  return [...new Map(values.filter(Boolean).map((value) => [normalizeAnalysisName(value), value])).values()]
}

function splitPageText(text, maximumCharacters) {
  if (!text.length) return ['']
  const parts = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + maximumCharacters, text.length)
    if (end < text.length) {
      const paragraphBoundary = text.lastIndexOf('\n\n', end)
      const lineBoundary = text.lastIndexOf('\n', end)
      const boundary = paragraphBoundary > start + maximumCharacters / 2
        ? paragraphBoundary + 2
        : lineBoundary > start + maximumCharacters / 2 ? lineBoundary + 1 : end
      end = boundary
    }
    parts.push(text.slice(start, end))
    start = end
  }
  return parts
}

export function createAnalysisChunks(pages, maximumCharacters = DEFAULT_CHUNK_CHARACTERS) {
  const chunks = []
  let currentPages = []
  let currentCharacters = 0

  function flush() {
    if (currentPages.length) chunks.push({ pages: currentPages })
    currentPages = []
    currentCharacters = 0
  }

  for (const page of pages) {
    const segments = splitPageText(page.originalText, maximumCharacters)
    for (const segment of segments) {
      if (currentCharacters && currentCharacters + segment.length > maximumCharacters) flush()
      const previous = currentPages.at(-1)
      if (previous?.pageNumber === page.pageNumber) {
        previous.originalText += segment
      } else {
        currentPages.push({ ...page, originalText: segment })
      }
      currentCharacters += segment.length
      if (currentCharacters >= maximumCharacters) flush()
    }
  }
  flush()
  return chunks
}

function mergeAnalysisChunks(outputs) {
  const topics = new Map()
  const concepts = new Map()
  const relationships = new Map()
  const subject = outputs.find((output) => output.subject)?.subject || 'Study material'

  for (const output of outputs) {
    for (const topic of output.topics) {
      const topicKey = normalizeAnalysisName(topic.name)
      const mergedTopic = topics.get(topicKey) || { ...topic, subtopics: [] }
      mergedTopic.description ||= topic.description
      for (const subtopic of topic.subtopics) {
        const subtopicKey = normalizeAnalysisName(subtopic.name)
        const existing = mergedTopic.subtopics.find(
          (item) => normalizeAnalysisName(item.name) === subtopicKey,
        )
        if (!existing) mergedTopic.subtopics.push({ ...subtopic })
        else existing.description ||= subtopic.description
      }
      topics.set(topicKey, mergedTopic)
    }

    for (const concept of output.concepts) {
      const conceptKey = normalizeAnalysisName(concept.name)
      const mergedConcept = concepts.get(conceptKey) || {
        ...concept,
        topicNames: [],
        prerequisites: [],
        relatedConcepts: [],
        examples: [],
        formulas: [],
        importantFacts: [],
        sourceReferences: [],
      }
      mergedConcept.definition ||= concept.definition
      mergedConcept.explanation ||= concept.explanation
      for (const field of ['topicNames', 'prerequisites', 'relatedConcepts', 'examples', 'formulas', 'importantFacts']) {
        mergedConcept[field] = uniqueStrings([...mergedConcept[field], ...concept[field]])
      }
      const references = new Map(
        mergedConcept.sourceReferences.map((reference) => [
          `${reference.pageNumber}:${normalizeAnalysisName(reference.quote)}`,
          reference,
        ]),
      )
      for (const reference of concept.sourceReferences) {
        references.set(`${reference.pageNumber}:${normalizeAnalysisName(reference.quote)}`, reference)
      }
      mergedConcept.sourceReferences = [...references.values()]
      concepts.set(conceptKey, mergedConcept)
    }

    for (const relationship of output.relationships) {
      const key = [
        normalizeAnalysisName(relationship.fromConcept),
        normalizeAnalysisName(relationship.toConcept),
        relationship.type,
      ].join(':')
      const merged = relationships.get(key) || { ...relationship, sourceReferences: [] }
      merged.evidence ||= relationship.evidence
      const references = new Map(
        merged.sourceReferences.map((reference) => [
          `${reference.pageNumber}:${normalizeAnalysisName(reference.quote)}`,
          reference,
        ]),
      )
      for (const reference of relationship.sourceReferences) {
        references.set(`${reference.pageNumber}:${normalizeAnalysisName(reference.quote)}`, reference)
      }
      merged.sourceReferences = [...references.values()]
      relationships.set(key, merged)
    }
  }

  for (const concept of concepts.values()) {
    for (const prerequisite of concept.prerequisites) {
      const key = `${normalizeAnalysisName(concept.name)}:${normalizeAnalysisName(prerequisite)}:PREREQUISITE`
      if (!relationships.has(key)) {
        relationships.set(key, {
          fromConcept: concept.name,
          toConcept: prerequisite,
          type: 'PREREQUISITE',
          evidence: `${concept.name} requires ${prerequisite}.`,
          sourceReferences: concept.sourceReferences,
        })
      }
    }
    for (const related of concept.relatedConcepts) {
      const key = `${normalizeAnalysisName(concept.name)}:${normalizeAnalysisName(related)}:RELATED`
      if (!relationships.has(key)) {
        relationships.set(key, {
          fromConcept: concept.name,
          toConcept: related,
          type: 'RELATED',
          evidence: `${concept.name} is related to ${related}.`,
          sourceReferences: concept.sourceReferences,
        })
      }
    }
  }

  return {
    subject,
    topics: [...topics.values()],
    concepts: [...concepts.values()],
    relationships: [...relationships.values()],
  }
}

function analysisErrorMessage(error) {
  if (error?.name === 'AnalysisConfigurationError' || error?.name === 'AnalysisOutputError') {
    return error.message
  }
  if (error instanceof HttpError) return error.message
  if (error?.message?.startsWith('The AI provider')) return error.message
  if (error?.message?.startsWith('PDF text extraction')) return error.message
  if (error?.message?.startsWith('PDF extraction timed out')) return error.message
  if (error?.message?.startsWith('No readable text')) return error.message
  return 'Analysis failed. Check the document and service configuration, then retry.'
}

function publicAnalysisStatus(analysis) {
  return {
    documentId: analysis.documentId,
    status: analysis.status,
    progress: analysis.progress,
    stage: analysis.stage,
    error: analysis.error,
    startedAt: analysis.startedAt,
    completedAt: analysis.completedAt,
  }
}

function validateSettings() {
  const chunkCharacters = Number(process.env.ANALYSIS_CHUNK_CHARACTERS || DEFAULT_CHUNK_CHARACTERS)
  const concurrency = Number(process.env.ANALYSIS_CONCURRENCY || 1)
  if (!Number.isSafeInteger(chunkCharacters) || chunkCharacters < 2000 || chunkCharacters > 30000) {
    throw new Error('ANALYSIS_CHUNK_CHARACTERS must be between 2000 and 30000.')
  }
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new Error('ANALYSIS_CONCURRENCY must be between 1 and 4.')
  }
  return { chunkCharacters, concurrency }
}

export function createAnalysisService(prisma, overrides = {}) {
  const documentStorage = documentSettings(overrides).storageDir
  const documentService = createDocumentService(prisma, { storageDir: documentStorage })
  const ai = overrides.ai || createAnalysisAi({ fetchImpl: overrides.fetchImpl })
  const extractPages = overrides.extractPages || ((filePath) => (
    extractPdfPages(filePath, { storageDir: documentStorage })
  ))
  const { chunkCharacters, concurrency } = validateSettings()
  const pending = []
  const queuedKeys = new Set()
  const activeKeys = new Set()
  let activeWorkers = 0
  let stopping = false
  let startPromise
  let recoveryTimer
  let recoveryPromise

  function pump() {
    if (stopping) return
    while (activeWorkers < concurrency && pending.length) {
      const job = pending.shift()
      const key = `${job.userId}:${job.documentId}`
      queuedKeys.delete(key)
      if (activeKeys.has(key)) continue
      activeWorkers += 1
      activeKeys.add(key)
      processJob(job)
        .catch((error) => {
          console.error('Analysis queue worker failed.', error)
        })
        .finally(() => {
          activeWorkers -= 1
          activeKeys.delete(key)
          pump()
          if (!stopping && pending.length === 0) {
            recoverPendingJobs().catch((error) => console.error('Analysis queue recovery failed.', error))
          }
        })
    }
  }

  function queueJob(job) {
    if (stopping || pending.length >= MAX_PENDING_JOBS) return
    const key = `${job.userId}:${job.documentId}`
    if (queuedKeys.has(key) || activeKeys.has(key)) return
    pending.push(job)
    queuedKeys.add(key)
    pump()
  }

  async function start() {
    if (startPromise) return startPromise
    stopping = false
    startPromise = (async () => {
      await recoverPendingJobs()
      recoveryTimer = setInterval(() => {
        recoverPendingJobs().catch((error) => console.error('Analysis queue recovery failed.', error))
      }, 60000)
      recoveryTimer.unref?.()
    })()
    return startPromise
  }

  async function recoverPendingJobs() {
    if (stopping) return
    if (recoveryPromise) return recoveryPromise
    recoveryPromise = (async () => {
      const staleBefore = new Date(Date.now() - 15 * 60 * 1000)
      await prisma.documentAnalysis.updateMany({
        where: { status: 'PROCESSING', updatedAt: { lt: staleBefore } },
        data: { status: 'QUEUED', progress: 0, stage: 'Waiting for analysis worker', error: null },
      })
      const waiting = await prisma.documentAnalysis.findMany({
        where: { status: 'QUEUED' },
        select: { id: true, documentId: true, userId: true },
        orderBy: { createdAt: 'asc' },
        take: MAX_PENDING_JOBS,
      })
      for (const analysis of waiting) {
        if (stopping || pending.length >= MAX_PENDING_JOBS) break
        queueJob(analysis)
      }
    })()
    try {
      await recoveryPromise
    } finally {
      recoveryPromise = null
    }
  }

  async function setProgress(analysisId, progress, stage) {
    await prisma.documentAnalysis.update({
      where: { id: analysisId },
      data: { progress, stage },
    })
  }

  async function saveExtractedPages(job, pages) {
    await prisma.extractedPage.deleteMany({
      where: { documentAnalysisId: job.id },
    })
    if (!pages.length) return
    await prisma.extractedPage.createMany({
      data: pages.map((page) => ({
        documentId: job.documentId,
        documentAnalysisId: job.id,
        pageNumber: page.pageNumber,
        originalText: page.originalText,
        textContext: page.textContext,
        section: page.section || 'Unlabelled section',
        headings: page.headings,
        subheadings: page.subheadings,
        paragraphs: page.paragraphs,
        definitions: page.definitions,
        examples: page.examples,
        formulas: page.formulas,
        tables: page.tables,
        importantTerms: page.importantTerms,
        sections: page.sections,
      })),
    })
  }

  async function persistAnalysis(job, result) {
    await prisma.$transaction(async (transaction) => {
      await transaction.conceptRelationship.deleteMany({
        where: { documentAnalysisId: job.id },
      })
      await transaction.conceptSource.deleteMany({
        where: { documentAnalysisId: job.id },
      })
      await transaction.topic.deleteMany({
        where: { documentAnalysisId: job.id },
      })

      const topicIds = new Map()
      for (const topic of result.topics) {
        const root = await transaction.topic.create({
          data: {
            documentAnalysisId: job.id,
            name: topic.name,
            normalizedName: normalizeAnalysisName(topic.name).slice(0, 240),
            description: topic.description,
          },
        })
        topicIds.set(normalizeAnalysisName(topic.name), root.id)
        for (const subtopic of topic.subtopics) {
          const subtopicKey = `${normalizeAnalysisName(topic.name)}:${normalizeAnalysisName(subtopic.name)}`.slice(0, 240)
          const child = await transaction.topic.create({
            data: {
              documentAnalysisId: job.id,
              parentId: root.id,
              name: subtopic.name,
              normalizedName: subtopicKey,
              description: subtopic.description,
            },
          })
          if (!topicIds.has(normalizeAnalysisName(subtopic.name))) {
            topicIds.set(normalizeAnalysisName(subtopic.name), child.id)
          }
        }
      }

      const conceptIds = new Map()
      for (const concept of result.concepts) {
        const normalizedName = normalizeAnalysisName(concept.name).slice(0, 240)
        if (!normalizedName) continue
        const where = { userId_normalizedName: { userId: job.userId, normalizedName } }
        const existing = await transaction.concept.findUnique({ where })
        const values = {
          definition: concept.definition,
          detailedExplanation: concept.explanation,
          examples: uniqueStrings(concept.examples),
          formulas: uniqueStrings(concept.formulas),
          importantFacts: uniqueStrings(concept.importantFacts),
        }
        const saved = existing
          ? await transaction.concept.update({
              where: { id: existing.id },
              data: {
                definition: existing.definition || values.definition,
                detailedExplanation: existing.detailedExplanation || values.detailedExplanation,
                examples: uniqueStrings([...existing.examples, ...values.examples]),
                formulas: uniqueStrings([...existing.formulas, ...values.formulas]),
                importantFacts: uniqueStrings([...existing.importantFacts, ...values.importantFacts]),
              },
            })
          : await transaction.concept.create({
              data: { userId: job.userId, name: concept.name, normalizedName, ...values },
            })
        conceptIds.set(normalizedName, saved.id)

        for (const topicName of concept.topicNames) {
          const topicId = topicIds.get(normalizeAnalysisName(topicName))
          if (topicId) {
            await transaction.topicConcept.upsert({
              where: { topicId_conceptId: { topicId, conceptId: saved.id } },
              create: { topicId, conceptId: saved.id },
              update: {},
            })
          }
        }

        const sourcesByPage = new Map()
        for (const reference of concept.sourceReferences) {
          const current = sourcesByPage.get(reference.pageNumber) || []
          current.push(reference.quote)
          sourcesByPage.set(reference.pageNumber, current)
        }
        for (const [pageNumber, excerpts] of sourcesByPage) {
          const sourceContext = {
            definition: concept.definition,
            explanation: concept.explanation,
            examples: concept.examples,
            formulas: concept.formulas,
            importantFacts: concept.importantFacts,
          }
          await transaction.conceptSource.upsert({
            where: {
              conceptId_documentAnalysisId_pageNumber: {
                conceptId: saved.id,
                documentAnalysisId: job.id,
                pageNumber,
              },
            },
            create: {
              conceptId: saved.id,
              documentAnalysisId: job.id,
              documentId: job.documentId,
              pageNumber,
              excerpt: uniqueStrings(excerpts).join('\n'),
              sourceContext,
            },
            update: {
              excerpt: uniqueStrings(excerpts).join('\n'),
              sourceContext,
            },
          })
        }
      }

      const relations = new Map()
      for (const relationship of result.relationships) {
        const fromName = normalizeAnalysisName(relationship.fromConcept)
        const toName = normalizeAnalysisName(relationship.toConcept)
        const key = `${fromName}:${toName}:${relationship.type}`
        const pages = uniqueStrings(relationship.sourceReferences.map((reference) => String(reference.pageNumber)))
          .map(Number)
        relations.set(key, {
          fromName,
          toName,
          type: relationship.type,
          evidence: relationship.evidence,
          sourcePageNumbers: pages,
        })
      }

      for (const relation of relations.values()) {
        const fromId = conceptIds.get(relation.fromName)
          || (await transaction.concept.findUnique({
            where: {
              userId_normalizedName: {
                userId: job.userId,
                normalizedName: relation.fromName.slice(0, 240),
              },
            },
            select: { id: true },
          }))?.id
        const toId = conceptIds.get(relation.toName)
          || (await transaction.concept.findUnique({
            where: {
              userId_normalizedName: {
                userId: job.userId,
                normalizedName: relation.toName.slice(0, 240),
              },
            },
            select: { id: true },
          }))?.id
        if (!fromId || !toId || fromId === toId) continue
        await transaction.conceptRelationship.upsert({
          where: {
            documentAnalysisId_fromConceptId_toConceptId_type: {
              documentAnalysisId: job.id,
              fromConceptId: fromId,
              toConceptId: toId,
              type: relation.type,
            },
          },
          create: {
            userId: job.userId,
            documentAnalysisId: job.id,
            fromConceptId: fromId,
            toConceptId: toId,
            type: relation.type,
            evidence: relation.evidence,
            sourcePageNumbers: relation.sourcePageNumbers,
          },
          update: {
            evidence: relation.evidence,
            sourcePageNumbers: relation.sourcePageNumbers,
          },
        })
      }

      await transaction.concept.deleteMany({
        where: { userId: job.userId, sources: { none: {} } },
      })
    })
  }

  async function processJob(job) {
    try {
      const claim = await prisma.documentAnalysis.updateMany({
        where: { id: job.id, status: 'QUEUED' },
        data: {
          status: 'PROCESSING',
          progress: 2,
          stage: 'Opening your PDF',
          error: null,
          startedAt: new Date(),
          completedAt: null,
        },
      })
      if (claim.count !== 1) return
      await prisma.document.update({
        where: { id: job.documentId },
        data: { uploadStatus: 'PROCESSING' },
      })

      const { filePath } = await documentService.open(job.userId, job.documentId)
      await setProgress(job.id, 8, 'Extracting page text and structure')
      const extracted = await extractPages(filePath)
      const pages = extracted.pages.filter((page) => (
        typeof page.originalText === 'string' && Number.isInteger(page.pageNumber) && page.pageNumber > 0
      ))
      if (!pages.length || !pages.some((page) => page.originalText.trim())) {
        throw new Error('No readable text was found in this PDF. Scanned pages may need OCR before analysis.')
      }

      await saveExtractedPages(job, pages)
      const chunks = createAnalysisChunks(pages, chunkCharacters)
      const existing = await prisma.concept.findMany({
        where: { userId: job.userId },
        select: { name: true },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      })
      const knownConcepts = existing.map(({ name }) => name)
      const outputs = []
      for (let index = 0; index < chunks.length; index += 1) {
        const output = await ai.analyzeChunk({
          pages: chunks[index].pages,
          knownConcepts: uniqueStrings([
            ...knownConcepts.slice(0, 40),
            ...outputs.flatMap((item) => item.concepts.map(({ name }) => name)).slice(-60),
          ]).slice(0, 100),
        })
        outputs.push(output)
        const progress = 10 + Math.round((index + 1) / chunks.length * 75)
        await setProgress(job.id, progress, `Understanding section ${index + 1} of ${chunks.length}`)
      }

      const result = mergeAnalysisChunks(outputs)
      await setProgress(job.id, 90, 'Connecting topics and concepts')
      await persistAnalysis(job, result)
      await prisma.documentAnalysis.update({
        where: { id: job.id },
        data: {
          subject: result.subject,
          status: 'COMPLETED',
          progress: 100,
          stage: 'Analysis complete',
          error: null,
          completedAt: new Date(),
        },
      })
      await prisma.document.update({
        where: { id: job.documentId },
        data: { uploadStatus: 'ANALYSIS_COMPLETED' },
      })
    } catch (error) {
      const message = analysisErrorMessage(error)
      console.error(`Analysis failed for document ${job.documentId}.`, error)
      await prisma.documentAnalysis.update({
        where: { id: job.id },
        data: { status: 'FAILED', stage: 'Analysis failed', error: message, completedAt: new Date() },
      })
      await prisma.document.update({
        where: { id: job.documentId },
        data: { uploadStatus: 'FAILED' },
      })
    }
  }

  async function enqueue(userId, documentIds) {
    await start()
    const ids = [...new Set(documentIds)]
    const documents = await prisma.document.findMany({
      where: { userId, id: { in: ids } },
    })
    if (documents.length !== ids.length) {
      throw new HttpError(404, 'One or more papers were not found in your library.')
    }

    const queued = []
    for (const documentId of ids) {
      let analysis = await prisma.documentAnalysis.findUnique({ where: { documentId } })
      if (analysis?.status === 'COMPLETED') {
        queued.push(publicAnalysisStatus(analysis))
        continue
      }
      if (analysis?.status === 'PROCESSING' || analysis?.status === 'QUEUED') {
        queueJob({ id: analysis.id, documentId, userId })
        queued.push(publicAnalysisStatus(analysis))
        continue
      }

      analysis = await prisma.documentAnalysis.upsert({
        where: { documentId },
        create: {
          userId,
          documentId,
          status: 'QUEUED',
          progress: 0,
          stage: 'Waiting for analysis worker',
        },
        update: {
          status: 'QUEUED',
          progress: 0,
          stage: 'Waiting for analysis worker',
          error: null,
          startedAt: null,
          completedAt: null,
        },
      })
      await prisma.document.update({
        where: { id: documentId },
        data: { uploadStatus: 'PROCESSING' },
      })
      queueJob({ id: analysis.id, documentId, userId })
      queued.push(publicAnalysisStatus(analysis))
    }
    return queued
  }

  async function getOwnedDocument(userId, documentId) {
    const document = await prisma.document.findFirst({ where: { id: documentId, userId } })
    if (!document) throw new HttpError(404, 'Paper not found.')
    return document
  }

  async function getStatus(userId, documentId) {
    await getOwnedDocument(userId, documentId)
    const analysis = await prisma.documentAnalysis.findUnique({ where: { documentId } })
    if (!analysis) return { documentId, status: 'NOT_STARTED', progress: 0, stage: null, error: null }
    return {
      documentId,
      status: analysis.status,
      progress: analysis.progress,
      stage: analysis.stage,
      error: analysis.error,
      startedAt: analysis.startedAt,
      completedAt: analysis.completedAt,
    }
  }

  async function getAnalysis(userId, documentId) {
    const document = await getOwnedDocument(userId, documentId)
    const documentSummary = {
      id: document.id,
      fileName: document.fileName,
      uploadedAt: document.uploadedAt,
      uploadStatus: document.uploadStatus,
    }
    const analysis = await prisma.documentAnalysis.findUnique({
      where: { documentId },
      include: {
        topics: { orderBy: { name: 'asc' } },
        conceptSources: { include: { concept: true } },
        conceptRelationships: { include: { fromConcept: true, toConcept: true } },
      },
    })
    if (!analysis) return { document: documentSummary, analysis: null }

    const topics = analysis.topics.filter((topic) => !topic.parentId).map((topic) => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      subtopics: analysis.topics
        .filter((candidate) => candidate.parentId === topic.id)
        .map((subtopic) => ({
          id: subtopic.id,
          name: subtopic.name,
          description: subtopic.description,
        })),
    }))
    const conceptsById = new Map()
    for (const source of analysis.conceptSources) {
      const concept = conceptsById.get(source.conceptId) || {
        id: source.concept.id,
        name: source.concept.name,
        definition: source.concept.definition,
        detailedExplanation: source.concept.detailedExplanation,
        examples: source.concept.examples,
        formulas: source.concept.formulas,
        importantFacts: source.concept.importantFacts,
        sourceReferences: [],
      }
      concept.sourceReferences.push({
        documentId: source.documentId,
        pageNumber: source.pageNumber,
        excerpt: source.excerpt,
        context: source.sourceContext,
      })
      conceptsById.set(source.conceptId, concept)
    }
    const relationships = analysis.conceptRelationships.map((relationship) => ({
      id: relationship.id,
      type: relationship.type,
      fromConcept: { id: relationship.fromConcept.id, name: relationship.fromConcept.name },
      toConcept: { id: relationship.toConcept.id, name: relationship.toConcept.name },
      evidence: relationship.evidence,
      sourcePageNumbers: relationship.sourcePageNumbers,
    }))

    return {
      document: documentSummary,
      analysis: {
        id: analysis.id,
        subject: analysis.subject,
        status: analysis.status,
        progress: analysis.progress,
        stage: analysis.stage,
        error: analysis.error,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
        topics,
        concepts: [...conceptsById.values()],
        relationships,
      },
    }
  }

  async function listTopics(userId, documentId) {
    if (documentId) await getOwnedDocument(userId, documentId)
    const topics = await prisma.topic.findMany({
      where: documentId
        ? { documentAnalysis: { userId, documentId } }
        : { documentAnalysis: { userId } },
      include: {
        documentAnalysis: {
          select: { document: { select: { id: true, fileName: true } } },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })
    return topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      parentId: topic.parentId,
      document: topic.documentAnalysis.document,
    }))
  }

  async function listConcepts(userId, { search, cursor, limit }) {
    if (cursor) {
      const cursorConcept = await prisma.concept.findFirst({ where: { id: cursor, userId } })
      if (!cursorConcept) throw new HttpError(400, 'The concept page cursor is invalid.')
    }
    const where = {
      userId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    }
    const concepts = await prisma.concept.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
      include: { _count: { select: { sources: true } } },
    })
    const hasMore = concepts.length > limit
    const items = concepts.slice(0, limit).map((concept) => ({
      id: concept.id,
      name: concept.name,
      definition: concept.definition,
      detailedExplanation: concept.detailedExplanation,
      sourceCount: concept._count.sources,
    }))
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null }
  }

  async function getConcept(userId, conceptId) {
    const concept = await prisma.concept.findFirst({
      where: { id: conceptId, userId },
      include: {
        sources: {
          include: {
            document: { select: { id: true, fileName: true } },
            documentAnalysis: { select: { subject: true } },
          },
          orderBy: [{ documentId: 'asc' }, { pageNumber: 'asc' }],
        },
        outgoingRelationships: { include: { toConcept: true } },
        incomingRelationships: { include: { fromConcept: true } },
      },
    })
    if (!concept) throw new HttpError(404, 'Concept not found.')
    return {
      id: concept.id,
      name: concept.name,
      definition: concept.definition,
      detailedExplanation: concept.detailedExplanation,
      examples: concept.examples,
      formulas: concept.formulas,
      importantFacts: concept.importantFacts,
      sources: concept.sources.map((source) => ({
        document: source.document,
        subject: source.documentAnalysis.subject,
        pageNumber: source.pageNumber,
        excerpt: source.excerpt,
        context: source.sourceContext,
      })),
      relationships: [
        ...concept.outgoingRelationships.map((item) => ({
          type: item.type,
          direction: 'outgoing',
          concept: { id: item.toConcept.id, name: item.toConcept.name },
          evidence: item.evidence,
          sourcePageNumbers: item.sourcePageNumbers,
        })),
        ...concept.incomingRelationships.map((item) => ({
          type: item.type,
          direction: 'incoming',
          concept: { id: item.fromConcept.id, name: item.fromConcept.name },
          evidence: item.evidence,
          sourcePageNumbers: item.sourcePageNumbers,
        })),
      ],
    }
  }

  async function waitForIdle() {
    while (activeWorkers || pending.length || recoveryPromise) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  async function stop() {
    stopping = true
    if (recoveryTimer) clearInterval(recoveryTimer)
    if (recoveryPromise) await recoveryPromise
    while (activeWorkers) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  return {
    enqueue,
    getAnalysis,
    getConcept,
    getStatus,
    listConcepts,
    listTopics,
    start,
    stop,
    waitForIdle,
  }
}
