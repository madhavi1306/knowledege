export function createAssessmentController(assessmentService) {
  return {
    generate: async (req, res, next) => {
      try {
        const { documentId } = req.params
        const { scope, topicId, chapterTitle, difficulty, questionCount } = req.body || {}

        const result = await assessmentService.generateTest({
          userId: req.userId,
          documentId,
          scope,
          topicId,
          chapterTitle,
          difficulty,
          questionCount,
        })

        return res.status(201).json(result)
      } catch (error) {
        return next(error)
      }
    },

    getTest: async (req, res, next) => {
      try {
        const { sessionId } = req.params
        const result = await assessmentService.getTest(req.userId, sessionId)
        return res.json(result)
      } catch (error) {
        return next(error)
      }
    },

    submit: async (req, res, next) => {
      try {
        const { sessionId } = req.params
        const { answers } = req.body || {}

        const result = await assessmentService.submitTest({
          userId: req.userId,
          sessionId,
          answers,
        })

        return res.json(result)
      } catch (error) {
        return next(error)
      }
    },

    getHistory: async (req, res, next) => {
      try {
        const { documentId } = req.params
        const result = await assessmentService.getTestHistory(req.userId, documentId)
        return res.json(result)
      } catch (error) {
        return next(error)
      }
    },
  }
}
