import { Router } from 'express'
import { createLearningController } from '../controllers/learning-controller.js'
import { requireAuth } from '../middleware/require-auth.js'

export function createLearningRoutes(service) {
  const router = Router()
  const controller = createLearningController(service)

  router.use(requireAuth)
  router.get('/:documentId', controller.getWorkspace)
  router.get('/:documentId/topics/:topicId', controller.getTopicMaterial)
  router.post('/:documentId/topics/:topicId/regenerate', controller.regenerateTopicMaterial)
  router.post('/:documentId/generate-all', controller.generateAllMaterials)
  router.patch('/:documentId/topics/:topicId/status', controller.updateStatus)

  return router
}
