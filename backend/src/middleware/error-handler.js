import { ZodError } from 'zod'
import multer from 'multer'
import { HttpError } from '../utils/http-error.js'
import { FileStoreError } from '../utils/file-store.js'

export function errorHandler(error, req, res, _next) {
  req.releaseUploadSlot?.()

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: error.issues[0]?.message ?? 'Please check the information you entered.',
      issues: error.issues.map(({ path, message }) => ({ path, message })),
    })
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message })
  }

  if (error instanceof FileStoreError) {
    return res.status(503).json({ error: error.message })
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: `This PDF is larger than the per-file limit of ${req.maxPdfSizeMb} MB.`,
      })
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Upload one PDF per queued request.' })
    }
    return res.status(400).json({ error: 'The PDF upload could not be accepted.' })
  }

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' })
  }

  console.error(error)
  return res.status(500).json({ error: 'Something went wrong. Please try again.' })
}
