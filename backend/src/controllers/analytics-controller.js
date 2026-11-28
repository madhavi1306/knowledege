import { z } from 'zod'

const trackEventSchema = z.object({
  documentId: z.string().optional().nullable(),
  topicId: z.string().optional().nullable(),
  eventType: z.enum([
    'TOPIC_VIEWED',
    'TOPIC_STUDIED',
    'MATERIAL_GENERATED',
    'TOPIC_COMPLETED',
    'TEST_ATTEMPTED',
    'TEST_COMPLETED',
    'REVISION_STARTED',
    'RETEST_COMPLETED',
  ]),
  title: z.string().min(1).max(240),
  details: z.any().optional(),
})

export function createAnalyticsController(analyticsService) {
  return {
    getDashboard: async (req, res, next) => {
      try {
        const dashboard = await analyticsService.getDashboardAnalytics(req.userId)
        return res.json(dashboard)
      } catch (error) {
        return next(error)
      }
    },

    getDocumentProgress: async (req, res, next) => {
      try {
        const { documentId } = req.params
        const docAnalytics = await analyticsService.getDocumentAnalytics(req.userId, documentId)
        return res.json(docAnalytics)
      } catch (error) {
        return next(error)
      }
    },

    trackEvent: async (req, res, next) => {
      try {
        const input = trackEventSchema.parse(req.body)
        const event = await analyticsService.recordActivityEvent(req.userId, input)
        return res.status(201).json({ event })
      } catch (error) {
        return next(error)
      }
    },
  }
}
