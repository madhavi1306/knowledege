import { Router } from 'express'
import { createAdaptiveController } from '../controllers/adaptive-controller.js'
import { requireAuth } from '../middleware/require-auth.js'

export function createAdaptiveRoutes(service) {
  const router = Router()
  const controller = createAdaptiveController(service)

  router.use(requireAuth)

  router.get('/weak-topics', controller.listWeakTopics)
  router.get('/:documentId/weak-topics', controller.listWeakTopics)
  router.get('/records/:recordId/reteach', controller.getReteach)
  router.post('/records/:recordId/retest', controller.generateRetest)
  router.post('/sessions/:sessionId/retest-submit', controller.submitRetest)

  return router
}
