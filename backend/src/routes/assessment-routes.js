import { Router } from 'express'
import { createAssessmentController } from '../controllers/assessment-controller.js'
import { requireAuth } from '../middleware/require-auth.js'

export function createAssessmentRoutes(service) {
  const router = Router()
  const controller = createAssessmentController(service)

  router.use(requireAuth)

  router.post('/:documentId/generate', controller.generate)
  router.get('/:documentId/history', controller.getHistory)
  router.get('/sessions/:sessionId', controller.getTest)
  router.post('/sessions/:sessionId/submit', controller.submit)

  return router
}
