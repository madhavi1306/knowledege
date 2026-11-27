import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { errorHandler } from './middleware/error-handler.js'
import { createAuthRoutes } from './routes/auth-routes.js'
import { createDocumentRoutes } from './routes/document-routes.js'
import { createProfileRoutes } from './routes/profile-routes.js'

export function createApp(prisma, documentOptions) {
  const app = express()
  const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173'

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({ origin: frontendOrigin, credentials: true }))
  app.use(express.json({ limit: '16kb' }))
  app.use(cookieParser())
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
  app.use('/api/auth', createAuthRoutes(prisma))
  app.use('/api/profile', createProfileRoutes(prisma))
  app.use('/api/documents', createDocumentRoutes(prisma, documentOptions))
  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }))
  app.use(errorHandler)
  return app
}
