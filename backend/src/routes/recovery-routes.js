import { Router } from 'express'
import { requireAuth } from '../middleware/require-auth.js'
import { createRecoveryService } from '../services/recovery-service.js'

export function createRecoveryRoutes(prisma) {
  const service = createRecoveryService(prisma)
  const router = Router()

  router.use(requireAuth)

  router.get('/', async (req, res, next) => {
    try {
      const sessions = await service.listActiveRecoverySessions(req.userId)
      return res.json({ sessions })
    } catch (err) {
      return next(err)
    }
  })

  router.get('/:id', async (req, res, next) => {
    try {
      const session = await service.getRecoverySession(req.userId, req.params.id)
      return res.json({ session })
    } catch (err) {
      return next(err)
    }
  })

  router.post('/:id/steps/:stepId/reteach', async (req, res, next) => {
    try {
      const { approach } = req.body || {}
      const step = await service.reteachStep(
        req.userId,
        req.params.id,
        req.params.stepId,
        approach || 'ANALOGY'
      )
      return res.json({ step })
    } catch (err) {
      return next(err)
    }
  })

  router.post('/:id/steps/:stepId/submit-mini-test', async (req, res, next) => {
    try {
      const { answers } = req.body || {}
      const result = await service.submitMiniTest(
        req.userId,
        req.params.id,
        req.params.stepId,
        answers || {}
      )
      return res.json(result)
    } catch (err) {
      return next(err)
    }
  })

  return router
}
