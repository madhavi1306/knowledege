export function createAdaptiveController(adaptiveService) {
  return {
    listWeakTopics: async (req, res, next) => {
      try {
        const { documentId } = req.params
        const weakTopics = await adaptiveService.listWeakTopics(req.userId, documentId)
        return res.json({ weakTopics })
      } catch (error) {
        return next(error)
      }
    },

    getReteach: async (req, res, next) => {
      try {
        const { recordId } = req.params
        const result = await adaptiveService.getOrGenerateAdaptiveReteach(req.userId, recordId)
        return res.json(result)
      } catch (error) {
        return next(error)
      }
    },

    generateRetest: async (req, res, next) => {
      try {
        const { recordId } = req.params
        const result = await adaptiveService.generateRetest(req.userId, recordId)
        return res.status(201).json(result)
      } catch (error) {
        return next(error)
      }
    },

    submitRetest: async (req, res, next) => {
      try {
        const { sessionId } = req.params
        const { answers } = req.body || {}
        const result = await adaptiveService.submitRetest({
          userId: req.userId,
          sessionId,
          answers,
        })
        return res.json(result)
      } catch (error) {
        return next(error)
      }
    },
  }
}
