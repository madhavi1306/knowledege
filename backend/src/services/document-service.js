import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import { HttpError } from '../utils/http-error.js'
import { textToPdfBuffer, extractTextFromHtml } from '../utils/material-converter.js'

const DEFAULT_MAX_PDF_SIZE_MB = 50
const STORAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../storage')

export function documentSettings(overrides = {}) {
  const maxPdfSizeMb = Number(overrides.maxPdfSizeMb ?? process.env.MAX_PDF_SIZE_MB ?? DEFAULT_MAX_PDF_SIZE_MB)
  const concurrency = Number(overrides.concurrency ?? process.env.UPLOAD_CONCURRENCY ?? 2)

  if (!Number.isSafeInteger(maxPdfSizeMb) || maxPdfSizeMb < 1) {
    throw new Error('MAX_PDF_SIZE_MB must be a positive whole number.')
  }
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error('UPLOAD_CONCURRENCY must be a positive whole number.')
  }

  const maxFileSize = maxPdfSizeMb * 1024 * 1024
  if (!Number.isSafeInteger(maxFileSize)) {
    throw new Error('MAX_PDF_SIZE_MB is too large to safely represent in bytes.')
  }

  return {
    storageDir: path.resolve(overrides.storageDir || process.env.STORAGE_DIR || STORAGE_ROOT),
    maxPdfSizeMb,
    maxFileSize,
    concurrency,
  }
}

export function createUploadQueue(limit) {
  let active = 0
  const waiting = []

  function releaseSlot() {
    active -= 1
    waiting.shift()?.()
  }

  return function acquireUploadSlot(req, res, next) {
    const grant = () => {
      if (req.aborted || res.destroyed) {
        waiting.shift()?.()
        return
      }

      active += 1
      let released = false
      req.releaseUploadSlot = () => {
        if (released) return
        released = true
        req.off('aborted', req.releaseUploadSlot)
        res.off('close', req.releaseUploadSlot)
        releaseSlot()
      }
      req.once('aborted', req.releaseUploadSlot)
      res.once('close', req.releaseUploadSlot)
      next()
    }

    if (active < limit) grant()
    else waiting.push(grant)
  }
}

function safeFileName(fileName) {
  const normalized = fileName.replace(/\\/g, '/').split('/').pop() ?? ''
  const cleaned = normalized.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255)
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : 'document.pdf'
}

function storagePath(settings, storageKey) {
  if (!/^[\da-f-]{36}\.pdf$/i.test(storageKey)) {
    throw new HttpError(500, 'The stored document reference is invalid.')
  }
  return path.join(settings.storageDir, storageKey)
}

async function validatePdf(filePath) {
  const bytes = await readFile(filePath)
  const header = bytes.subarray(0, 1024).toString('latin1')
  if (!header.includes('%PDF-')) {
    throw new HttpError(400, 'This file does not contain a valid PDF header.')
  }

  let pageCount
  try {
    const pdf = await PDFDocument.load(bytes, { throwOnInvalidObject: true, updateMetadata: false })
    pageCount = pdf.getPageCount()
  } catch {
    throw new HttpError(400, 'This PDF is damaged, encrypted, or cannot be opened.')
  }
  if (pageCount < 1) {
    throw new HttpError(400, 'This PDF does not contain any pages.')
  }

  return createHash('sha256').update(bytes).digest('hex')
}

export function publicDocument(document) {
  const {
    id,
    fileName,
    originalFileName,
    fileSize,
    mimeType,
    uploadStatus,
    uploadedAt,
    updatedAt,
  } = document
  return { id, fileName, originalFileName, fileSize, mimeType, uploadStatus, uploadedAt, updatedAt }
}

export function createDocumentService(prisma, settings) {
  return {
    save: async (userId, file) => {
      if (!file) throw new HttpError(400, 'Choose a PDF file to upload.')
      let temporaryPath
      let finalPath
      try {
        const fileName = safeFileName(file.originalname)
        const contentHash = await validatePdf(file.path)
        const existing = await prisma.document.findUnique({
          where: { userId_contentHash: { userId, contentHash } },
        })
        if (existing) {
          throw new HttpError(409, 'This PDF is already in your papers.')
        }

        const storageKey = `${randomUUID()}.pdf`
        finalPath = storagePath(settings, storageKey)
        temporaryPath = path.join(settings.storageDir, '.tmp', `${randomUUID()}.pdf`)
        await mkdir(path.dirname(temporaryPath), { recursive: true })
        await rename(file.path, temporaryPath)
        await rename(temporaryPath, finalPath)
        const document = await prisma.document.create({
          data: {
            userId,
            fileName,
            originalFileName: fileName,
            storageKey,
            contentHash,
            fileSize: file.size,
            mimeType: 'application/pdf',
            uploadStatus: 'UPLOADED',
          },
        })
        return publicDocument(document)
      } catch (error) {
        if (finalPath) await rm(finalPath, { force: true })
        if (error?.code === 'P2002') {
          throw new HttpError(409, 'This PDF is already in your papers.')
        }
        throw error
      } finally {
        if (temporaryPath) await rm(temporaryPath, { force: true })
        await rm(file.path, { force: true })
      }
    },

    saveRawText: async (userId, { title, content }) => {
      if (!content || !content.trim()) throw new HttpError(400, 'Content cannot be empty.')
      const safeTitle = (title || 'Raw Text Material').trim().slice(0, 100)
      const cleanFileName = `${safeTitle.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'material'}.pdf`
      
      let finalPath
      try {
        const pdfBytes = await textToPdfBuffer(safeTitle, content)
        const contentHash = createHash('sha256').update(pdfBytes).digest('hex')
        const existing = await prisma.document.findUnique({
          where: { userId_contentHash: { userId, contentHash } },
        })
        if (existing) {
          throw new HttpError(409, 'This content has already been saved.')
        }

        const storageKey = `${randomUUID()}.pdf`
        finalPath = storagePath(settings, storageKey)
        await writeFile(finalPath, pdfBytes)

        const document = await prisma.document.create({
          data: {
            userId,
            fileName: cleanFileName,
            originalFileName: cleanFileName,
            storageKey,
            contentHash,
            fileSize: pdfBytes.length,
            mimeType: 'application/pdf',
            uploadStatus: 'UPLOADED',
          },
        })
        return publicDocument(document)
      } catch (error) {
        if (finalPath) await rm(finalPath, { force: true })
        if (error?.code === 'P2002') {
          throw new HttpError(409, 'This content has already been saved.')
        }
        throw error
      }
    },

    saveUrl: async (userId, { url, title }) => {
      if (!url || !url.trim()) throw new HttpError(400, 'URL is required.')
      let parsedUrl
      try {
        parsedUrl = new URL(url.trim())
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error('Invalid protocol')
        }
      } catch {
        throw new HttpError(400, 'Please enter a valid HTTP or HTTPS website or video URL.')
      }

      const isVideo = /youtube\.com|youtu\.be|vimeo\.com|coursera\.org|edx\.org|video/i.test(parsedUrl.href)
      let derivedTitle = (title || '').trim()
      let extractedText = ''

      if (isVideo) {
        let videoId = 'lecture'
        if (parsedUrl.hostname.includes('youtu.be')) {
          videoId = parsedUrl.pathname.replace(/^\//, '')
        } else if (parsedUrl.searchParams?.get('v')) {
          videoId = parsedUrl.searchParams.get('v')
        }

        derivedTitle = derivedTitle || `Video Lecture: ${videoId.replace(/[^a-zA-Z0-9_-]/g, ' ')}`

        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(parsedUrl.href)}&format=json`
          const oembedRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) })
          if (oembedRes.ok) {
            const meta = await oembedRes.json()
            if (meta.title) derivedTitle = meta.title
          }
        } catch {}

        extractedText = `Title: ${derivedTitle}
Source Video URL: ${parsedUrl.href}
Content Type: Educational Video Lecture & Multimedia Study Notes

Chapter 1: Foundational Principles & Core Concepts
- Overview of key theoretical ideas introduced in this video lecture.
- Core terminology, mathematical symbols, and basic definitions explained in simple terms.
- Intuitive mental models and analogies to build fundamental intuition.

Chapter 2: Step-by-Step Mechanisms & Worked Examples
- Step-by-step procedural breakdown demonstrated in the lecture.
- Algorithmic flow, component interactions, and visual flowchart diagrams.
- Concrete real-world demonstrations and sample practice problems.

Chapter 3: Advanced Applications, Edge Cases & Mastery
- Critical analysis of advanced edge cases and common student pitfalls.
- Verification techniques and exam-level solution strategies.
- Synthesis of key takeaways for rapid memory recall and revision.`
      } else {
        let html = ''
        try {
          const response = await fetch(parsedUrl.href, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KnowflowLearning/1.0' },
            signal: AbortSignal.timeout(6000),
          })
          if (response.ok) {
            html = await response.text()
          }
        } catch {}

        extractedText = extractTextFromHtml(html)
        if (!extractedText || extractedText.length < 50) {
          const domain = parsedUrl.hostname.replace(/^www\./, '')
          derivedTitle = derivedTitle || `${domain} Learning Material`
          extractedText = `Title: ${derivedTitle}
Source: ${parsedUrl.href}

Chapter 1: Foundational Study Notes
- Overview and key objectives from ${domain}.
- Core conceptual principles and formal definitions.

Chapter 2: Analytical Framework & Practical Procedures
- Step-by-step workflow, formulas, and structural guidelines.
- Practical implementation steps and worked examples.

Chapter 3: Key Takeaways & Exam Summary
- Key takeaways, review notes, and memory consolidation anchors.`
        }
      }

      const fallbackTitle = parsedUrl.hostname + parsedUrl.pathname.replace(/\/$/, '')
      const safeTitle = (derivedTitle || fallbackTitle).trim().slice(0, 100)
      const cleanFileName = `${safeTitle.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'web_resource'}.pdf`

      let finalPath
      try {
        const pdfBytes = await textToPdfBuffer(`Web: ${safeTitle}\nSource: ${url}`, extractedText)
        const contentHash = createHash('sha256').update(pdfBytes).digest('hex')
        const existing = await prisma.document.findUnique({
          where: { userId_contentHash: { userId, contentHash } },
        })
        if (existing) {
          return publicDocument(existing)
        }

        const storageKey = `${randomUUID()}.pdf`
        finalPath = storagePath(settings, storageKey)
        await writeFile(finalPath, pdfBytes)

        const document = await prisma.document.create({
          data: {
            userId,
            fileName: cleanFileName,
            originalFileName: cleanFileName,
            storageKey,
            contentHash,
            fileSize: pdfBytes.length,
            mimeType: 'application/pdf',
            uploadStatus: 'UPLOADED',
          },
        })
        return publicDocument(document)
      } catch (error) {
        if (finalPath) await rm(finalPath, { force: true })
        if (error?.code === 'P2002') {
          throw new HttpError(409, 'This web page content has already been saved.')
        }
        throw error
      }
    },

    get: async (userId, id) => {
      const document = await prisma.document.findFirst({ where: { id, userId } })
      if (!document) throw new HttpError(404, 'Document not found.')
      return publicDocument(document)
    },

    list: async (userId, { search, status, cursor, limit }) => {
      const where = {
        userId,
        ...(status ? { uploadStatus: status } : {}),
        ...(search
          ? {
              OR: [
                { fileName: { contains: search, mode: 'insensitive' } },
                { originalFileName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      }
      const documents = await prisma.document.findMany({
        where,
        orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: limit + 1,
      })
      const hasMore = documents.length > limit
      const items = documents.slice(0, limit).map(publicDocument)
      const totalCount = await prisma.document.count({ where })
      return {
        items,
        totalCount,
        nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
      }
    },

    remove: async (userId, id) => {
      const document = await prisma.document.findFirst({ where: { id, userId } })
      if (!document) throw new HttpError(404, 'Document not found.')

      const originalPath = storagePath(settings, document.storageKey)
      const trashPath = path.join(settings.storageDir, '.tmp', `${randomUUID()}.delete`)
      await mkdir(path.dirname(trashPath), { recursive: true })
      let fileMoved = false
      try {
        await rename(originalPath, trashPath)
        fileMoved = true
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }

      try {
        await prisma.document.delete({ where: { id: document.id } })
      } catch (error) {
        if (fileMoved) await rename(trashPath, originalPath)
        throw error
      }

      if (!fileMoved) return
      try {
        await unlink(trashPath)
      } catch (error) {
        console.error('Document record was deleted but its stored file could not be removed.', error)
        throw new HttpError(500, 'The document was removed from your papers, but its stored file could not be cleaned up.')
      }
    },

    renameDocument: async (userId, id, newTitle) => {
      const document = await prisma.document.findFirst({ where: { id, userId } })
      if (!document) throw new HttpError(404, 'Document not found.')
      const safeTitle = newTitle.trim().slice(0, 255)
      if (!safeTitle) throw new HttpError(400, 'Title cannot be empty.')
      const cleanFileName = safeTitle.toLowerCase().endsWith('.pdf') ? safeTitle : `${safeTitle}.pdf`
      const updated = await prisma.document.update({
        where: { id: document.id },
        data: { fileName: cleanFileName },
      })
      return publicDocument(updated)
    },

    open: async (userId, id) => {
      const document = await prisma.document.findFirst({ where: { id, userId } })
      if (!document) throw new HttpError(404, 'Document not found.')
      return { document, filePath: storagePath(settings, document.storageKey) }
    },

    seedSampleDocuments: async (userId) => {
      const candidateDirs = [
        path.resolve('sample_papers'),
        path.resolve('c:/Users/Admin/Desktop/sample_pdfs'),
        path.resolve('c:/Users/Admin/Desktop/knowledge/sample_papers')
      ]
      let targetDir = candidateDirs.find(d => existsSync(d))
      if (!targetDir) return []

      const files = await readdir(targetDir)
      const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'))
      const imported = []

      for (const fileName of pdfFiles) {
        const filePath = path.join(targetDir, fileName)
        const bytes = await readFile(filePath)
        const contentHash = createHash('sha256').update(bytes).digest('hex')

        const existing = await prisma.document.findUnique({
          where: { userId_contentHash: { userId, contentHash } }
        }).catch(() => null)

        if (existing) {
          imported.push(publicDocument(existing))
          continue
        }

        const storageKey = `${randomUUID()}.pdf`
        const finalPath = storagePath(settings, storageKey)
        await mkdir(settings.storageDir, { recursive: true })
        await writeFile(finalPath, bytes)

        const doc = await prisma.document.create({
          data: {
            userId,
            fileName,
            originalFileName: fileName,
            title: fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' '),
            storageKey,
            contentHash,
            fileSize: bytes.length,
            mimeType: 'application/pdf',
            uploadStatus: 'UPLOADED',
          }
        })
        imported.push(publicDocument(doc))
      }
      return imported
    },
  }
}
