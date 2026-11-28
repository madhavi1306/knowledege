import { Router } from 'express'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createDocumentController } from '../controllers/document-controller.js'
import { requireAuth } from '../middleware/require-auth.js'
import { createDocumentService, createUploadQueue, documentSettings } from '../services/document-service.js'
import { HttpError } from '../utils/http-error.js'

export function createDocumentRoutes(prisma, overrides = {}) {
  const settings = documentSettings(overrides)
  const service = createDocumentService(prisma, settings)
  const controller = createDocumentController(service)
  const router = Router()
  const temporaryDirectory = path.join(settings.storageDir, '.tmp')
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        mkdir(temporaryDirectory, { recursive: true })
          .then(() => callback(null, temporaryDirectory))
          .catch(callback)
      },
      filename: (_req, _file, callback) => callback(null, `${randomUUID()}.upload`),
    }),
    limits: {
      fileSize: settings.maxFileSize,
      files: 1,
      fields: 0,
    },
    fileFilter: (req, file, callback) => {
      req.maxPdfSizeMb = settings.maxPdfSizeMb
      const isPdfName = file.originalname.toLowerCase().endsWith('.pdf')
      const isPdfMime = !file.mimetype || file.mimetype.toLowerCase().includes('pdf') || file.mimetype === 'application/octet-stream'
      if (!isPdfName && !isPdfMime) {
        return callback(new HttpError(400, 'Only PDF files can be uploaded.'))
      }
      return callback(null, true)
    },
  })

  router.use(requireAuth)
  router.get('/', controller.list)
  router.post('/upload', createUploadQueue(settings.concurrency), upload.single('file'), controller.upload)
  router.post('/seed-samples', controller.seedSamples)
  router.post('/text', controller.saveText)
  router.post('/url', controller.saveUrl)
  router.get('/:id/status', controller.status)
  router.get('/:id/file', controller.open)
  router.patch('/:id', controller.rename)
  router.get('/:id', controller.get)
  router.delete('/:id', controller.remove)
  return router
}
