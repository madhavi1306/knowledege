import { Router } from 'express'
import { createVisualController } from '../controllers/visual-controller.js'
import { requireAuth } from '../middleware/require-auth.js'

export function createVisualRoutes(service) {
  const router = Router()
  const controller = createVisualController(service)

  router.use(requireAuth)
  router.get('/:documentId', controller.list)
  router.get('/:documentId/word-meaning', controller.wordMeaning)
  router.post('/:documentId/word-meaning', controller.wordMeaning)
  router.get('/:documentId/page/:pageNumber/image', controller.image)
  router.get('/:documentId/:visualId', controller.get)
  router.post('/:documentId/:visualId/ask', controller.ask)

  return router
}
