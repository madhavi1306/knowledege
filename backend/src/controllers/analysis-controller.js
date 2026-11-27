import { z } from 'zod'

const batchSchema = z.object({
  documentIds: z.array(z.string().trim().min(1).max(64)).min(1),
}).strict()

const topicsQuerySchema = z.object({
  documentId: z.string().trim().min(1).max(64).optional(),
}).strict()

const conceptsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  cursor: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict()

export function createAnalysisController(service) {
  return {
    start: async (req, res, next) => {
      try {
        const [analysis] = await service.enqueue(req.userId, [req.params.documentId])
        return res.status(202).json({ analysis })
      } catch (error) {
        return next(error)
      }
    },

    batch: async (req, res, next) => {
      try {
        const { documentIds } = batchSchema.parse(req.body)
        const analyses = await service.enqueue(req.userId, documentIds)
        return res.status(202).json({ analyses })
      } catch (error) {
        return next(error)
      }
    },

    get: async (req, res, next) => {
      try {
        return res.json(await service.getAnalysis(req.userId, req.params.documentId))
      } catch (error) {
        return next(error)
      }
    },

    status: async (req, res, next) => {
      try {
        return res.json({ status: await service.getStatus(req.userId, req.params.documentId) })
      } catch (error) {
        return next(error)
      }
    },

    topics: async (req, res, next) => {
      try {
        const { documentId } = topicsQuerySchema.parse(req.query)
        return res.json({ topics: await service.listTopics(req.userId, documentId) })
      } catch (error) {
        return next(error)
      }
    },

    concepts: async (req, res, next) => {
      try {
        const query = conceptsQuerySchema.parse(req.query)
        return res.json(await service.listConcepts(req.userId, query))
      } catch (error) {
        return next(error)
      }
    },

    concept: async (req, res, next) => {
      try {
        return res.json({ concept: await service.getConcept(req.userId, req.params.id) })
      } catch (error) {
        return next(error)
      }
    },
  }
}
