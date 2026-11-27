import { Router } from 'express'
import { createAnalysisController } from '../controllers/analysis-controller.js'
import { requireAuth } from '../middleware/require-auth.js'

export function createAnalysisRoutes(service) {
  const router = Router()
  const controller = createAnalysisController(service)

  router.use(requireAuth)
  router.post('/batch', controller.batch)
  router.get('/topics', controller.topics)
  router.get('/concepts', controller.concepts)
  router.get('/concepts/:id', controller.concept)
  router.post('/:documentId', controller.start)
  router.get('/:documentId/status', controller.status)
  router.get('/:documentId', controller.get)
  return router
}
