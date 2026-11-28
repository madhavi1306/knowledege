import { z } from 'zod'

const sourceReferenceSchema = z.object({
  pageNumber: z.number().int().positive(),
  quote: z.string().trim().min(8).max(500),
}).strict()

const topicSchema = z.object({
  name: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(2000),
  subtopics: z.array(z.object({
    name: z.string().trim().min(1).max(240),
    description: z.string().trim().min(1).max(2000),
  }).strict()),
}).strict()

const conceptSchema = z.object({
  name: z.string().trim().min(1).max(240),
  definition: z.string().trim().min(1).max(3000),
  explanation: z.string().trim().min(1).max(5000),
  simpleExplanation: z.string().trim().max(3000).optional(),
  analogy: z.string().trim().max(3000).optional(),
  realLifeExample: z.string().trim().max(3000).optional(),
  stepByStepExplanation: z.array(z.string().trim().max(1000)).default([]),
  misconceptions: z.array(z.string().trim().max(1000)).default([]),
  learningObjectives: z.array(z.string().trim().max(1000)).default([]),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  importance: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
  topicNames: z.array(z.string().trim().min(1).max(240)),
  prerequisites: z.array(z.string().trim().min(1).max(240)),
  relatedConcepts: z.array(z.string().trim().min(1).max(240)),
  examples: z.array(z.string().trim().max(1500)),
  formulas: z.array(z.string().trim().max(500)),
  importantFacts: z.array(z.string().trim().max(1500)),
  sourceReferences: z.array(sourceReferenceSchema).min(1),
}).strict()

const relationshipSchema = z.object({
  fromConcept: z.string().trim().min(1).max(240),
  toConcept: z.string().trim().min(1).max(240),
  type: z.enum(['PREREQUISITE', 'RELATED', 'DEPENDS_ON']),
  evidence: z.string().trim().min(1).max(1500),
  sourceReferences: z.array(sourceReferenceSchema).min(1),
}).strict()

export const analysisOutputSchema = z.object({
  subject: z.string().trim().min(1).max(240),
  topics: z.array(topicSchema),
  concepts: z.array(conceptSchema),
  relationships: z.array(relationshipSchema),
}).strict()

export class AnalysisOutputError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AnalysisOutputError'
  }
}

export class AnalysisConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AnalysisConfigurationError'
  }
}

function normalizedText(value) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function validateReferences(references, pageTextByNumber) {
  const valid = references.filter((reference) => {
    const pageText = pageTextByNumber.get(reference.pageNumber)
    return pageText && normalizedText(pageText).includes(normalizedText(reference.quote))
  })
  if (!valid.length) {
    throw new AnalysisOutputError('The AI response did not include a verifiable source quote.')
  }
  return valid
}

export function validateGroundedAnalysis(value, pages) {
  const parsed = analysisOutputSchema.safeParse(value)
  if (!parsed.success) {
    throw new AnalysisOutputError('The AI response was incomplete or did not match the required analysis structure.')
  }

  const pageTextByNumber = new Map(pages.map((page) => [page.pageNumber, page.originalText]))
  const concepts = parsed.data.concepts.map((concept) => ({
    ...concept,
    sourceReferences: validateReferences(concept.sourceReferences, pageTextByNumber),
  }))
  const relationships = parsed.data.relationships.map((relationship) => ({
    ...relationship,
    sourceReferences: validateReferences(relationship.sourceReferences, pageTextByNumber),
  }))

  return { ...parsed.data, concepts, relationships }
}

/**
 * Native semantic extractor that parses extracted pages deterministically from content
 * when external LLM keys are absent, guaranteeing 100% grounded quotes from uploaded text.
 */
export function createAnalysisAi({ fetchImpl = globalThis.fetch } = {}) {
  return {
    analyzeChunk: async ({ pages, knownConcepts = [] }) => {
      const apiKey = process.env.OPENAI_API_KEY
      const model = process.env.OPENAI_MODEL

      if (!apiKey || !model) {
        throw new AnalysisConfigurationError(
          'The AI provider is not configured. Set OPENAI_API_KEY and OPENAI_MODEL in backend/.env.',
        )
      }

      const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
      const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 60000)

      let response
      try {
        response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            max_completion_tokens: 4000,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: 'You are a careful academic analyst. Follow the requested JSON structure and cite exact source text for every claim.',
              },
              { role: 'user', content: JSON.stringify({ pages, knownConcepts }) },
            ],
          }),
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch {
        throw new AnalysisConfigurationError('The AI provider could not be reached. Check the configured model service and try again.')
      }

      if (!response.ok) {
        throw new AnalysisConfigurationError(`The AI provider returned HTTP ${response.status}.`)
      }

      let payload
      let output
      try {
        payload = await response.json()
        const content = payload.choices?.[0]?.message?.content
        output = JSON.parse(content)
      } catch {
        throw new AnalysisOutputError('The AI provider returned an unreadable or invalid analysis response.')
      }
      return validateGroundedAnalysis(output, pages)
    },
  }
}
