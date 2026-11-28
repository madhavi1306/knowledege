import { Router } from 'express'
import { requireAuth } from '../middleware/require-auth.js'
import { createQuizService } from '../services/quiz-service.js'

export function createQuizRoutes(prisma) {
  const service = createQuizService(prisma)
  const router = Router()

  router.use(requireAuth)

  router.get('/', async (req, res, next) => {
    try {
      const sessions = await service.listQuizSessions(req.userId)
      return res.json({ sessions })
    } catch (err) {
      return next(err)
    }
  })

  router.post('/start', async (req, res, next) => {
    try {
      const { documentAnalysisId, mode, questionCount, targetConceptIds } = req.body || {}
      const session = await service.createQuizSession(req.userId, {
        documentAnalysisId,
        mode,
        questionCount: Number(questionCount) || 5,
        targetConceptIds: Array.isArray(targetConceptIds) ? targetConceptIds : [],
      })
      return res.status(201).json({ session })
    } catch (err) {
      return next(err)
    }
  })

  router.get('/:id', async (req, res, next) => {
    try {
      const session = await service.getQuizSession(req.userId, req.params.id)
      return res.json({ session })
    } catch (err) {
      return next(err)
    }
  })

  router.post('/:id/submit', async (req, res, next) => {
    try {
      const { answers } = req.body || {}
      const evaluated = await service.submitQuizSession(req.userId, req.params.id, answers || {})
      return res.json({ session: evaluated })
    } catch (err) {
      return next(err)
    }
  })

  return router
}
