import { Router } from 'express'
import { createAnalyticsController } from '../controllers/analytics-controller.js'
import { requireAuth } from '../middleware/require-auth.js'

export function createAnalyticsRoutes(analyticsService) {
  const router = Router()
  const controller = createAnalyticsController(analyticsService)

  router.use(requireAuth)

  router.get('/dashboard', controller.getDashboard)
  router.get('/documents/:documentId', controller.getDocumentProgress)
  router.post('/events', controller.trackEvent)

  return router
}
