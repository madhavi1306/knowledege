import { Router } from 'express'
import { requireAuth } from '../middleware/require-auth.js'
import { createGraphService } from '../services/graph-service.js'

export function createGraphRoutes(prisma) {
  const service = createGraphService(prisma)
  const router = Router()

  router.use(requireAuth)

  router.get('/graph', async (req, res, next) => {
    try {
      const { documentId, documentAnalysisId, topicId, status } = req.query
      const result = await service.getKnowledgeGraph(req.userId, {
        documentId,
        documentAnalysisId,
        topicId,
        statusFilter: status,
      })
      return res.json(result)
    } catch (err) {
      return next(err)
    }
  })

  router.get('/concepts/:conceptId', async (req, res, next) => {
    try {
      const result = await service.getConceptDeepDetail(req.userId, req.params.conceptId)
      return res.json(result)
    } catch (err) {
      return next(err)
    }
  })

  router.post('/concepts/:conceptId/mastery', async (req, res, next) => {
    try {
      const { status, scoreDelta } = req.body || {}
      const updated = await service.updateMasteryStatus(
        req.userId,
        req.params.conceptId,
        status || 'LEARNING',
        Number(scoreDelta) || 0
      )
      return res.json({ mastery: updated })
    } catch (err) {
      return next(err)
    }
  })

  return router
}
