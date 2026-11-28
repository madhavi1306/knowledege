import { z } from 'zod'

const updateStatusSchema = z.object({
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']),
}).strict()

export function createLearningController(service) {
  return {
    getWorkspace: async (req, res, next) => {
      try {
        const workspace = await service.getLearningWorkspace(req.userId, req.params.documentId)
        return res.json(workspace)
      } catch (error) {
        return next(error)
      }
    },

    getTopicMaterial: async (req, res, next) => {
      try {
        const { documentId, topicId } = req.params
        const material = await service.generateTopicMaterial(req.userId, documentId, topicId, {
          forceRegenerate: req.query.regenerate === 'true',
        })
        return res.json({ material })
      } catch (error) {
        return next(error)
      }
    },

    regenerateTopicMaterial: async (req, res, next) => {
      try {
        const { documentId, topicId } = req.params
        const material = await service.generateTopicMaterial(req.userId, documentId, topicId, {
          forceRegenerate: true,
        })
        return res.json({ material })
      } catch (error) {
        return next(error)
      }
    },

    generateAllMaterials: async (req, res, next) => {
      try {
        const { documentId } = req.params
        const workspace = await service.getLearningWorkspace(req.userId, documentId)
        const results = []
        for (const topic of workspace.topics) {
          const material = await service.generateTopicMaterial(req.userId, documentId, topic.id)
          results.push(material)
        }
        return res.json({ count: results.length, materials: results })
      } catch (error) {
        return next(error)
      }
    },

    updateStatus: async (req, res, next) => {
      try {
        const { documentId, topicId } = req.params
        const { status } = updateStatusSchema.parse(req.body)
        const updated = await service.updateTopicStatus(req.userId, documentId, topicId, status)
        return res.json({ material: updated })
      } catch (error) {
        return next(error)
      }
    },
  }
}
