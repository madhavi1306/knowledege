import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import { HttpError } from '../utils/http-error.js'

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

    open: async (userId, id) => {
      const document = await prisma.document.findFirst({ where: { id, userId } })
      if (!document) throw new HttpError(404, 'Document not found.')
      return { document, filePath: storagePath(settings, document.storageKey) }
    },
  }
}
