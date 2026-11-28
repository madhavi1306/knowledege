import { Router } from 'express'
import { requireAuth } from '../middleware/require-auth.js'
import { createVoiceAgentService } from '../services/voice-agent-service.js'

export function createVoiceAgentRoutes(prisma) {
  const service = createVoiceAgentService(prisma)
  const router = Router()

  router.use(requireAuth)

  router.post('/chat', async (req, res, next) => {
    try {
      const { message, context, history } = req.body || {}
      const result = await service.chatWithVoiceAgent(req.userId, { message, context, history })
      return res.json(result)
    } catch (err) {
      return next(err)
    }
  })

  return router
}
