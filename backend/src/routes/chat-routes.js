import { Router } from 'express'
import { createChatController } from '../controllers/chat-controller.js'
import { requireAuth } from '../middleware/require-auth.js'

export function createChatRoutes(chatService) {
  const router = Router()
  const controller = createChatController(chatService)

  router.use(requireAuth)

  router.get('/:documentId/sessions', controller.listSessions)
  router.get('/:documentId/session', controller.getSession)
  router.post('/:documentId/sessions/:sessionId/messages', controller.sendMessage)
  router.post('/:documentId/ask', (req, res, next) => {
    req.params.sessionId = 'default'
    return controller.sendMessage(req, res, next)
  })
  router.delete('/sessions/:sessionId', controller.clearSession)

  return router
}
