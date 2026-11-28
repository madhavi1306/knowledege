import { createReadStream } from 'node:fs'
import { z } from 'zod'

const askQuestionSchema = z.object({
  question: z.string().trim().min(2, 'Question must be at least 2 characters.').max(500),
}).strict()

export function createVisualController(service) {
  return {
    list: async (req, res, next) => {
      try {
        const visuals = await service.listVisuals(req.userId, req.params.documentId)
        return res.json({ visuals })
      } catch (error) {
        return next(error)
      }
    },

    get: async (req, res, next) => {
      try {
        const visual = await service.getVisual(req.userId, req.params.documentId, req.params.visualId)
        return res.json({ visual })
      } catch (error) {
        return next(error)
      }
    },

    image: async (req, res, next) => {
      try {
        const { documentId, pageNumber } = req.params
        const filePath = await service.getVisualImageFile(req.userId, documentId, Number(pageNumber))
        res.set({
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
        })
        const stream = createReadStream(filePath)
        stream.pipe(res)
      } catch (error) {
        return next(error)
      }
    },

    ask: async (req, res, next) => {
      try {
        const { documentId, visualId } = req.params
        const { question } = askQuestionSchema.parse(req.body)
        const response = await service.answerVisualQuestion(req.userId, documentId, visualId, question)
        return res.json(response)
      } catch (error) {
        return next(error)
      }
    },

    wordMeaning: async (req, res, next) => {
      try {
        const { documentId } = req.params
        const word = (req.query.word || req.body?.word || '').trim()
        const visualId = req.query.visualId || req.body?.visualId || null
        const result = await service.getWordMeaning(req.userId, documentId, word, visualId)
        return res.json(result)
      } catch (error) {
        return next(error)
      }
    },
  }
}
