import { createReadStream } from 'node:fs'
import { z } from 'zod'
import { HttpError } from '../utils/http-error.js'

const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['UPLOADED', 'PROCESSING', 'ANALYSIS_COMPLETED', 'FAILED']).optional(),
  cursor: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
})

function encodedFileName(fileName) {
  return encodeURIComponent(fileName).replace(/[!'()*]/g, (character) => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ))
}

export function createDocumentController(service) {
  return {
    upload: async (req, res, next) => {
      try {
        const document = await service.save(req.userId, req.file)
        return res.status(201).json({ document })
      } catch (error) {
        return next(error)
      } finally {
        req.releaseUploadSlot?.()
      }
    },

    list: async (req, res, next) => {
      try {
        const query = listQuerySchema.parse(req.query)
        const result = await service.list(req.userId, query)
        return res.json(result)
      } catch (error) {
        return next(error)
      }
    },

    get: async (req, res, next) => {
      try {
        const document = await service.get(req.userId, req.params.id)
        return res.json({ document })
      } catch (error) {
        return next(error)
      }
    },

    status: async (req, res, next) => {
      try {
        const document = await service.get(req.userId, req.params.id)
        return res.json({
          id: document.id,
          uploadStatus: document.uploadStatus,
          uploadedAt: document.uploadedAt,
          updatedAt: document.updatedAt,
        })
      } catch (error) {
        return next(error)
      }
    },

    open: async (req, res, next) => {
      try {
        const { document, filePath } = await service.open(req.userId, req.params.id)
        res.set({
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `inline; filename="document.pdf"; filename*=UTF-8''${encodedFileName(document.fileName)}`,
          'Content-Security-Policy': "sandbox; default-src 'none'; script-src 'none'; object-src 'none'",
          'Content-Type': 'application/pdf',
          'Cross-Origin-Resource-Policy': 'same-origin',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        })

        const stream = createReadStream(filePath)
        stream.on('error', (error) => {
          if (error.code === 'ENOENT') {
            return next(new HttpError(410, 'The stored PDF is unavailable.'))
          }
          return next(error)
        })
        stream.pipe(res)
      } catch (error) {
        return next(error)
      }
    },

    remove: async (req, res, next) => {
      try {
        await service.remove(req.userId, req.params.id)
        return res.status(204).end()
      } catch (error) {
        return next(error)
      }
    },
  }
}
