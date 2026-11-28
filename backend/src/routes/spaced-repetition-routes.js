import { Router } from 'express'
import { requireAuth } from '../middleware/require-auth.js'
import { createSpacedRepetitionService } from '../services/spaced-repetition-service.js'

export function createSpacedRepetitionRoutes(prisma) {
  const service = createSpacedRepetitionService(prisma)
  const router = Router()

  router.use(requireAuth)

  router.get('/queue', async (req, res, next) => {
    try {
      const queue = await service.getDailyRevisionQueue(req.userId)
      return res.json(queue)
    } catch (err) {
      return next(err)
    }
  })

  router.post('/review', async (req, res, next) => {
    try {
      const { conceptId, rating } = req.body || {}
      const updated = await service.recordReview(req.userId, conceptId, Number(rating) || 3)
      return res.json({ review: updated })
    } catch (err) {
      return next(err)
    }
  })

  router.get('/analytics', async (req, res, next) => {
    try {
      const analytics = await service.getProgressAnalytics(req.userId)
      return res.json(analytics)
    } catch (err) {
      return next(err)
    }
  })

  return router
}
