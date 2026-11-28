export function createChatController(chatService) {
  return {
    listSessions: async (req, res, next) => {
      try {
        const { documentId } = req.params
        const sessions = await chatService.listSessions(req.userId, documentId)
        return res.json({ sessions })
      } catch (error) {
        return next(error)
      }
    },

    getSession: async (req, res, next) => {
      try {
        const { documentId } = req.params
        const { topicId } = req.query
        const session = await chatService.getOrCreateSession(req.userId, documentId, topicId)
        return res.json({ session })
      } catch (error) {
        return next(error)
      }
    },

    sendMessage: async (req, res, next) => {
      try {
        const { documentId, sessionId } = req.params
        const { question, topicId, language } = req.body || {}

        if (!question || typeof question !== 'string' || !question.trim()) {
          return res.status(400).json({ error: 'Question is required.' })
        }

        const result = await chatService.answerQuestion({
          userId: req.userId,
          documentId,
          sessionId: sessionId === 'default' ? null : sessionId,
          question: question.trim(),
          topicId,
          language,
        })

        return res.json(result)
      } catch (error) {
        return next(error)
      }
    },

    clearSession: async (req, res, next) => {
      try {
        const { sessionId } = req.params
        const result = await chatService.clearSession(req.userId, sessionId)
        return res.json(result)
      } catch (error) {
        return next(error)
      }
    },
  }
}
