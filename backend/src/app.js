import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { errorHandler } from './middleware/error-handler.js'
import { createAuthRoutes } from './routes/auth-routes.js'
import { createProfileRoutes } from './routes/profile-routes.js'
import { createDocumentRoutes } from './routes/document-routes.js'
import { createAnalysisRoutes } from './routes/analysis-routes.js'
import { createAnalysisService } from './services/analysis-service.js'
import { createLearningRoutes } from './routes/learning-routes.js'
import { createLearningService } from './services/learning-service.js'
import { createVisualRoutes } from './routes/visual-routes.js'
import { createVisualService } from './services/visual-service.js'
import { createChatRoutes } from './routes/chat-routes.js'
import { createChatService } from './services/chat-service.js'
import { createAssessmentRoutes } from './routes/assessment-routes.js'
import { createAssessmentService } from './services/assessment-service.js'
import { createAdaptiveRoutes } from './routes/adaptive-routes.js'
import { createAdaptiveLearningService } from './services/adaptive-learning-service.js'
import { createLearningAnalyticsService } from './services/learning-analytics-service.js'
import { createAnalyticsRoutes } from './routes/analytics-routes.js'
import { createGraphRoutes } from './routes/graph-routes.js'
import { createQuizRoutes } from './routes/quiz-routes.js'
import { createRecoveryRoutes } from './routes/recovery-routes.js'
import { createSpacedRepetitionRoutes } from './routes/spaced-repetition-routes.js'
import { createVoiceAgentRoutes } from './routes/voice-agent-routes.js'

export function createApp(prisma, documentOptions = {}, analysisOptions = {}) {
  const app = express()
  const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173'
  const analysisService = createAnalysisService(prisma, {
    ...documentOptions,
    ...analysisOptions,
  })
  const learningService = createLearningService(prisma)
  const visualService = createVisualService(prisma, documentOptions)
  const chatService = createChatService(prisma)
  const assessmentService = createAssessmentService(prisma)
  const adaptiveService = createAdaptiveLearningService(prisma)
  const analyticsService = createLearningAnalyticsService(prisma)

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({ origin: frontendOrigin, credentials: true }))
  app.use(express.json({ limit: '256kb' }))
  app.use(cookieParser())
  app.locals.analysisService = analysisService
  app.locals.learningService = learningService
  app.locals.visualService = visualService
  app.locals.chatService = chatService
  app.locals.assessmentService = assessmentService
  app.locals.adaptiveService = adaptiveService
  app.locals.analyticsService = analyticsService

  app.get('/api/health', (_req, res) => res.json({
    status: 'ok',
    phase: 10,
    persistenceBackend: app.locals.persistenceBackend || 'unknown',
  }))

  app.use('/api/learning', createGraphRoutes(prisma))
  app.use('/api/auth', createAuthRoutes(prisma))
  app.use('/api/profile', createProfileRoutes(prisma))
  app.use('/api/documents', createDocumentRoutes(prisma, documentOptions))
  app.use('/api/analysis', createAnalysisRoutes(analysisService))
  app.use('/api/learning', createLearningRoutes(learningService))
  app.use('/api/visuals', createVisualRoutes(visualService))
  app.use('/api/chat', createChatRoutes(chatService))
  app.use('/api/assessments', createAssessmentRoutes(assessmentService))
  app.use('/api/adaptive', createAdaptiveRoutes(adaptiveService))
  app.use('/api/analytics', createAnalyticsRoutes(analyticsService))
  app.use('/api/quizzes', createQuizRoutes(prisma))
  app.use('/api/recovery', createRecoveryRoutes(prisma))
  app.use('/api/spaced-repetition', createSpacedRepetitionRoutes(prisma))
  app.use('/api/voice-agent', createVoiceAgentRoutes(prisma))

  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }))
  app.use(errorHandler)
  return app
}
