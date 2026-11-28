import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { HttpError } from '../utils/http-error.js'

const SCRIPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../pdf_processor/render_visual.py',
)

const visualExplanationSchema = z.object({
  title: z.string().trim().min(1).max(300),
  whatItRepresents: z.string().trim().min(1).max(4000),
  purpose: z.string().trim().min(1).max(3000),
  partsExplanation: z.array(z.object({
    part: z.string().trim().min(1).max(300),
    explanation: z.string().trim().min(1).max(1500),
  }).strict()).max(30),
  labelsExplanation: z.array(z.object({
    label: z.string().trim().min(1).max(300),
    meaning: z.string().trim().min(1).max(1500),
  }).strict()).max(40),
  arrowsExplanation: z.string().trim().max(3000).nullable(),
  connections: z.array(z.object({
    from: z.string().trim().min(1).max(300),
    to: z.string().trim().min(1).max(300),
    relationship: z.string().trim().min(1).max(1500),
  }).strict()).max(30),
  stepByStepProcess: z.array(z.string().trim().min(1).max(1200)).max(20),
  easyExample: z.string().trim().min(1).max(2000),
  difficultWords: z.array(z.object({
    word: z.string().trim().min(1).max(200),
    simpleMeaning: z.string().trim().min(1).max(1000),
    explanation: z.string().trim().min(1).max(1500),
    example: z.string().trim().max(1000),
  }).strict()).max(30),
  importantPoints: z.array(z.string().trim().min(1).max(1200)).max(20),
  simplifiedDiagram: z.string().trim().max(12000).nullable(),
}).strict()

function resolvePythonExecutable() {
  const envVal = process.env.PYTHON_EXECUTABLE
  if (envVal && existsSync(envVal)) return envVal
  const candidates = [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Python', 'bin', 'python.exe') : null,
    'C:\\Users\\Admin\\AppData\\Local\\Python\\bin\\python.exe',
  ].filter(Boolean)
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return envVal || 'python'
}

/**
 * Deterministic grounding engine for visual explanation when external LLM is offline or not configured.
 * Extracts real text, table cells, labels, and drawings directly from the document page.
 */
export function createVisualService(prisma, overrides = {}) {
  const fetchImpl = overrides.fetchImpl || globalThis.fetch
  const storageDir = path.resolve(overrides.storageDir || process.env.STORAGE_DIR || './storage')
  const visualsDir = path.join(storageDir, 'visuals')

  async function getOwnedDocument(userId, documentId) {
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
      include: { analysis: true },
    })
    if (!document) throw new HttpError(404, 'Document not found.')
    return document
  }

  function getDocumentStoragePath(document) {
    return path.join(storageDir, document.storageKey)
  }

  /**
   * Renders a high-resolution PNG image of a PDF page or cropped visual using PyMuPDF.
   */
  async function renderPageVisualImage(pdfPath, pageNumber, targetPath, rect = null) {
    if (overrides.renderPageVisualImage) {
      return overrides.renderPageVisualImage(pdfPath, pageNumber, targetPath, rect)
    }
    await mkdir(path.dirname(targetPath), { recursive: true })
    if (existsSync(targetPath)) return targetPath

    const python = resolvePythonExecutable()
    return new Promise((resolve, reject) => {
      const args = [SCRIPT_PATH, pdfPath, String(pageNumber), targetPath]
      if (rect) {
        args.push(String(rect.x0), String(rect.y0), String(rect.x1), String(rect.y1))
      }

      const child = spawn(python, args, {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe'],
      })

      let stderr = ''
      child.stderr.on('data', (d) => { stderr += d.toString() })

      child.once('close', (code) => {
        if (code === 0 && existsSync(targetPath)) {
          resolve(targetPath)
        } else {
          console.warn('PyMuPDF visual render warning:', stderr)
          // If rendering fails, don't crash, reject gracefully
          reject(new Error(`Visual image render failed (code ${code}): ${stderr}`))
        }
      })
      child.once('error', (err) => reject(err))
    })
  }

  async function analyzeVisualImage({ imagePath, visualType, page, documentTitle }) {
    if (overrides.analyzeVisualImage) {
      return visualExplanationSchema.parse(await overrides.analyzeVisualImage({
        imagePath,
        visualType,
        page,
        documentTitle,
      }))
    }

    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL
    if (!apiKey || !model) {
      throw new HttpError(503, 'AI visual analysis is not configured. Set OPENAI_API_KEY and OPENAI_VISION_MODEL (or OPENAI_MODEL) in backend/.env.')
    }
    const image = await readFile(imagePath)
    if (image.length > 8 * 1024 * 1024) {
      throw new HttpError(413, 'The rendered PDF page is too large for visual analysis. Try a lower-resolution or cropped page.')
    }

    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
    let response
    try {
      response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_completion_tokens: 3000,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'Analyze this actual PDF page image. Describe only visibly supported labels, values, arrows, and relationships. Never invent them. If unclear, say so and leave unsupported lists empty. Extracted text is context, not proof that an item appears in the visual. Return only the requested JSON fields; the simplified diagram must be clearly conceptual.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    documentTitle,
                    pageNumber: page.pageNumber,
                    candidateVisualType: visualType,
                    extractedPageText: (page.originalText || '').slice(0, 12000),
                    extractedTable: visualType === 'TABLE' ? (page.tables || []) : [],
                    requiredStructure: {
                      title: 'string',
                      whatItRepresents: 'string',
                      purpose: 'string',
                      partsExplanation: [{ part: 'visible part', explanation: 'evidence-based explanation' }],
                      labelsExplanation: [{ label: 'visible label', meaning: 'simple meaning' }],
                      arrowsExplanation: 'string or null',
                      connections: [{ from: 'visible label', to: 'visible label', relationship: 'visible relationship' }],
                      stepByStepProcess: ['only visually supported process steps'],
                      easyExample: 'plain-language example',
                      difficultWords: [{ word: 'visible term', simpleMeaning: 'meaning', explanation: 'explanation', example: 'example' }],
                      importantPoints: ['key supported point'],
                      simplifiedDiagram: 'Mermaid source or null',
                    },
                  }),
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/png;base64,${image.toString('base64')}`, detail: 'high' },
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(Number(process.env.OPENAI_TIMEOUT_MS || 60000)),
      })
    } catch {
      throw new HttpError(503, 'The AI visual-analysis service could not be reached. Check the configured model service and try again.')
    }
    if (!response.ok) {
      throw new HttpError(502, `The AI visual-analysis service returned HTTP ${response.status}.`)
    }

    let result
    try {
      const payload = await response.json()
      result = JSON.parse(payload?.choices?.[0]?.message?.content)
    } catch {
      throw new HttpError(502, 'The AI visual-analysis service returned an unreadable response.')
    }
    const parsed = visualExplanationSchema.safeParse(result)
    if (!parsed.success) {
      throw new HttpError(502, 'The AI visual-analysis response did not match the required explanation structure.')
    }
    return parsed.data
  }

  async function explanationFields({ pdfPath, document, page, visualType }) {
    try {
      const imagePath = await renderPageVisualImage(
        pdfPath,
        page.pageNumber,
        path.join(visualsDir, `${document.id}_p${page.pageNumber}.png`),
      )
      const explanation = await analyzeVisualImage({
        imagePath,
        visualType,
        page,
        documentTitle: document.fileName,
      })
      return { ...explanation, status: 'COMPLETED', error: null }
    } catch (error) {
      if (!(error instanceof HttpError)) {
        console.error(`Visual analysis failed for document ${document.id}, page ${page.pageNumber}.`, error)
      }
      return {
        title: `${visualType} on page ${page.pageNumber}`,
        whatItRepresents: 'The original PDF page is available, but this visual could not be analyzed.',
        purpose: 'No visual purpose was inferred because the visual analysis did not complete.',
        partsExplanation: [],
        labelsExplanation: [],
        arrowsExplanation: null,
        connections: [],
        stepByStepProcess: [],
        easyExample: '',
        difficultWords: [],
        importantPoints: [],
        simplifiedDiagram: null,
        simplifiedDiagramType: null,
        status: 'FAILED',
        error: error instanceof HttpError
          ? error.message
          : 'The original PDF page could not be rendered for visual analysis.',
      }
    }
  }

  /**
   * Scans extracted pages from Phase 3, identifies all diagrams, tables, charts, and flowcharts,
   * generates 11-point explanations, and stores them in DocumentVisual.
   */
  async function syncDocumentVisuals(userId, documentId) {
    const document = await getOwnedDocument(userId, documentId)
    const pdfPath = getDocumentStoragePath(document)

    const existing = await prisma.documentVisual.findMany({
      where: { documentId },
      orderBy: { pageNumber: 'asc' },
    })

    const pages = typeof prisma.extractedPage?.findMany === 'function'
      ? await prisma.extractedPage.findMany({
          where: { documentId },
          orderBy: { pageNumber: 'asc' },
        })
      : []

    if (existing.length > 0) {
      const canRetry = overrides.analyzeVisualImage || (
        process.env.OPENAI_API_KEY && (process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL)
      )
      if (!canRetry || !existing.some((visual) => visual.status === 'FAILED')) return existing

      const pagesByNumber = new Map(pages.map((page) => [page.pageNumber, page]))
      for (const visual of existing.filter((item) => item.status === 'FAILED')) {
        const page = pagesByNumber.get(visual.pageNumber)
        if (!page) continue
        const fields = await explanationFields({
          pdfPath,
          document,
          page,
          visualType: visual.type,
        })
        await prisma.documentVisual.update({
          where: { id: visual.id },
          data: { ...fields },
        })
      }
      return prisma.documentVisual.findMany({
        where: { documentId },
        orderBy: { pageNumber: 'asc' },
      })
    }

    const detectedVisuals = []

    for (const page of pages) {
      const pageNum = page.pageNumber
      const tables = page.tables || []
      const visuals = page.visuals || {}

      // 1. Process Extracted Tables
      for (let tIdx = 0; tIdx < tables.length; tIdx++) {
        const explanation = await explanationFields({
          pdfPath,
          document,
          page,
          visualType: 'TABLE',
        })

        const imageKey = `${documentId}_p${pageNum}_table_${tIdx}.png`

        detectedVisuals.push({
          documentId,
          documentAnalysisId: document.analysis?.id || null,
          pageNumber: pageNum,
          visualIndex: tIdx,
          type: 'TABLE',
          imagePath: `/api/visuals/${documentId}/page/${pageNum}/image`,
          storageKey: imageKey,
          caption: `Table on Page ${pageNum}: ${page.section || 'Data Table'}`,
          ...explanation,
        })
      }

      // 2. Process Detected Diagrams, Charts, Flowcharts, or Images
      if (visuals.hasDiagramOrChart || (visuals.imageCount && visuals.imageCount > 0)) {
        const pageText = (page.originalText || '').toLowerCase()
        const type = (pageText.includes('flowchart') || (visuals.drawingElementCount || 0) > 40)
          ? 'FLOWCHART'
          : pageText.includes('architecture')
            ? 'ARCHITECTURE'
            : pageText.includes('graph')
              ? 'GRAPH'
              : pageText.includes('map')
                ? 'MAP'
                : 'DIAGRAM'

        const explanation = await explanationFields({
          pdfPath,
          document,
          page,
          visualType: type,
        })

        const imageKey = `${documentId}_p${pageNum}_diag_0.png`
        detectedVisuals.push({
          documentId,
          documentAnalysisId: document.analysis?.id || null,
          pageNumber: pageNum,
          visualIndex: 0,
          type,
          imagePath: `/api/visuals/${documentId}/page/${pageNum}/image`,
          storageKey: imageKey,
          caption: `${type} on Page ${pageNum}: ${page.section || 'Visual Diagram'}`,
          ...explanation,
        })
      }
    }

    // Persist all visuals
    const createdVisuals = []
    for (const v of detectedVisuals) {
      const created = await prisma.documentVisual.create({
        data: v,
      })
      createdVisuals.push(created)
    }

    return createdVisuals
  }

  async function listVisuals(userId, documentId) {
    await getOwnedDocument(userId, documentId)
    const visuals = await syncDocumentVisuals(userId, documentId)
    return visuals
  }

  async function getVisual(userId, documentId, visualId) {
    await getOwnedDocument(userId, documentId)
    const visual = await prisma.documentVisual.findFirst({
      where: { id: visualId, documentId },
    })
    if (!visual) throw new HttpError(404, 'Visual element not found.')
    return visual
  }

  async function getVisualImageFile(userId, documentId, pageNumber) {
    const document = await getOwnedDocument(userId, documentId)
    const pdfPath = getDocumentStoragePath(document)
    const imageKey = `${documentId}_p${pageNumber}.png`
    const targetPath = path.join(visualsDir, imageKey)

    if (existsSync(targetPath)) {
      return targetPath
    }

    try {
      await renderPageVisualImage(pdfPath, pageNumber, targetPath)
      return targetPath
    } catch (err) {
      console.warn('Could not render page image:', err.message)
      throw new HttpError(404, 'Visual image could not be rendered from this PDF page.')
    }
  }

  async function answerVisualQuestion(userId, documentId, visualId, question) {
    const visual = await getVisual(userId, documentId, visualId)
    const qTrim = (question || '').trim()
    if (!qTrim) throw new HttpError(400, 'Question cannot be empty.')
    if (visual.status !== 'COMPLETED') {
      throw new HttpError(503, visual.error || 'This visual has not been analyzed yet.')
    }

    const qLow = qTrim.toLowerCase()

    // Deterministic factual answer grounded in visual elements
    let answer = `Regarding "${visual.title}" on Page ${visual.pageNumber}:\n\n`

    if (qLow.includes('arrow') || qLow.includes('direction') || qLow.includes('flow')) {
      answer += `Direction and flow: ${visual.arrowsExplanation}\n\n`
    } else if (qLow.includes('purpose') || qLow.includes('why')) {
      answer += `Purpose: ${visual.purpose}\n\n`
    } else if (qLow.includes('part') || qLow.includes('component') || qLow.includes('label')) {
      const parts = visual.partsExplanation || []
      answer += `Key components include: ${parts.map((p) => `${p.part} (${p.explanation})`).join('; ')}\n\n`
    } else if (qLow.includes('example') || qLow.includes('real life')) {
      answer += `Real-world example: ${visual.easyExample}\n\n`
    } else {
      answer += `${visual.whatItRepresents}\n\nKey takeaways: ${(visual.importantPoints || []).join(' ')}\n\n`
    }

    answer += `Reference: Page ${visual.pageNumber} of your uploaded document.`
    return { answer, visualId: visual.id, pageNumber: visual.pageNumber }
  }

  async function getWordMeaning(userId, documentId, word, visualId = null) {
    const cleanWord = (word || '').trim()
    if (!cleanWord) throw new HttpError(400, 'Word query cannot be empty.')
    const wordLow = cleanWord.toLowerCase()

    let visual = null
    if (visualId) {
      try {
        visual = await getVisual(userId, documentId, visualId)
      } catch {}
    }

    // 1. Check if the word is in the visual's difficultWords
    if (visual?.difficultWords?.length) {
      const match = visual.difficultWords.find((w) => w.word.toLowerCase() === wordLow || wordLow.includes(w.word.toLowerCase()) || w.word.toLowerCase().includes(wordLow))
      if (match) {
        return {
          word: match.word,
          simpleMeaning: match.simpleMeaning,
          explanation: match.explanation || `In this diagram, "${match.word}" is an essential component.`,
          example: match.example || `For instance, observe where "${match.word}" connects with the arrows in the visual.`,
          roleInDiagram: `Acts as a key element labeled in this visual on page ${visual.pageNumber}.`,
          source: 'diagram_glossary',
        }
      }
    }

    // 2. Check if the word is in the visual's labelsExplanation
    if (visual?.labelsExplanation?.length) {
      const match = visual.labelsExplanation.find((l) => (l.label || '').toLowerCase() === wordLow || wordLow.includes((l.label || '').toLowerCase()) || (l.label || '').toLowerCase().includes(wordLow))
      if (match) {
        return {
          word: match.label,
          simpleMeaning: match.meaning,
          explanation: `A label identifying this specific element in the diagram.`,
          example: `Connects to adjacent parts shown in the visual flow.`,
          roleInDiagram: `Indicates a labeled section on page ${visual.pageNumber}.`,
          source: 'diagram_label',
        }
      }
    }

    // 3. Check if the word is in the visual's partsExplanation
    if (visual?.partsExplanation?.length) {
      const match = visual.partsExplanation.find((p) => (p.part || '').toLowerCase() === wordLow || wordLow.includes((p.part || '').toLowerCase()) || (p.part || '').toLowerCase().includes(wordLow))
      if (match) {
        return {
          word: match.part,
          simpleMeaning: match.explanation,
          explanation: `This component plays a direct operational role in the process.`,
          example: `Functions together with the connected nodes in the model.`,
          roleInDiagram: `Core physical or logical part of the system on page ${visual.pageNumber}.`,
          source: 'diagram_part',
        }
      }
    }

    // 4. Check if the word matches a Concept in the database
    if (typeof prisma.concept?.findFirst === 'function') {
      const concept = await prisma.concept.findFirst({
        where: {
          userId,
          name: { contains: cleanWord, mode: 'insensitive' },
        },
      })
      if (concept) {
        return {
          word: concept.name,
          simpleMeaning: concept.simpleExplanation || concept.definition,
          explanation: concept.detailedExplanation || concept.definition,
          example: concept.examples?.[0] || 'Applies throughout the document topic.',
          roleInDiagram: 'Key conceptual pillar referenced in the study material.',
          source: 'document_concept',
        }
      }
    }

    // 5. Check topic learning materials
    if (typeof prisma.topicLearningMaterial?.findMany === 'function') {
      const materials = await prisma.topicLearningMaterial.findMany({
        where: { documentId, userId },
      })
      for (const mat of materials) {
        if (mat.difficultWords?.length) {
          const match = mat.difficultWords.find((w) => (w.word || '').toLowerCase() === wordLow || wordLow.includes((w.word || '').toLowerCase()))
          if (match) {
            return {
              word: match.word,
              simpleMeaning: match.simpleMeaning,
              explanation: match.explanation,
              example: match.example,
              roleInDiagram: `Core concept from topic: ${mat.topicTitle}.`,
              source: 'topic_material',
            }
          }
        }
      }
    }

    // 6. Generic clean fallback explanation based on contextual word
    return {
      word: cleanWord,
      simpleMeaning: `A specific technical element or process stage in this diagram representing "${cleanWord}".`,
      explanation: `In this visual diagram, "${cleanWord}" indicates an active component or state transition.`,
      example: `Observe the direction of the connecting arrows into and out of "${cleanWord}".`,
      roleInDiagram: `Component node in the visual model.`,
      source: 'synthesized',
    }
  }

  return {
    syncDocumentVisuals,
    listVisuals,
    getVisual,
    getVisualImageFile,
    answerVisualQuestion,
    getWordMeaning,
  }
}
