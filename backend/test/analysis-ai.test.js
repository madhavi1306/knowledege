import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AnalysisConfigurationError,
  AnalysisOutputError,
  createAnalysisAi,
  validateGroundedAnalysis,
} from '../src/services/analysis-ai.js'

const sourceText = 'Cellular respiration converts glucose into ATP for cellular work.'
const validOutput = {
  subject: 'Biology',
  topics: [{
    name: 'Cellular energy',
    description: 'How cells release and store energy.',
    subtopics: [],
  }],
  concepts: [{
    name: 'Cellular respiration',
    definition: 'A process that converts glucose into ATP.',
    explanation: 'Cells release energy from glucose through linked reactions.',
    topicNames: ['Cellular energy'],
    prerequisites: [],
    relatedConcepts: [],
    examples: ['Muscle cells use ATP.'],
    formulas: [],
    importantFacts: [],
    sourceReferences: [{ pageNumber: 1, quote: 'Cellular respiration converts glucose into ATP' }],
  }],
  relationships: [],
}

function withOpenAiConfig(callback) {
  const previous = {
    key: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
  }
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.OPENAI_MODEL = 'test-model'
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      if (previous.key === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = previous.key
      if (previous.model === undefined) delete process.env.OPENAI_MODEL
      else process.env.OPENAI_MODEL = previous.model
    })
}

test('validates structured analysis and exact page-grounded citations', () => {
  const analysis = validateGroundedAnalysis(validOutput, [{
    pageNumber: 1,
    originalText: sourceText,
  }])

  assert.equal(analysis.subject, 'Biology')
  assert.equal(analysis.concepts[0].sourceReferences[0].pageNumber, 1)
  assert.throws(
    () => validateGroundedAnalysis(validOutput, [{ pageNumber: 2, originalText: sourceText }]),
    AnalysisOutputError,
  )
})

test('rejects incomplete or ungrounded model responses', () => {
  assert.throws(
    () => validateGroundedAnalysis({ subject: 'Biology' }, [{ pageNumber: 1, originalText: sourceText }]),
    AnalysisOutputError,
  )
  const inventedQuote = structuredClone(validOutput)
  inventedQuote.concepts[0].sourceReferences[0].quote = 'An unsupported claim from the model.'
  assert.throws(
    () => validateGroundedAnalysis(inventedQuote, [{ pageNumber: 1, originalText: sourceText }]),
    AnalysisOutputError,
  )
})

test('uses the configured backend AI provider and validates its JSON output', async () => {
  await withOpenAiConfig(async () => {
    let requestOptions
    const ai = createAnalysisAi({
      fetchImpl: async (_url, options) => {
        requestOptions = options
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify(validOutput) } }],
          }),
        }
      },
    })

    const result = await ai.analyzeChunk({
      pages: [{
        pageNumber: 1,
        section: 'Cellular energy',
        headings: ['Cellular respiration'],
        subheadings: [],
        definitions: [],
        examples: [],
        formulas: [],
        tables: [],
        importantTerms: [],
        originalText: sourceText,
      }],
    })

    assert.equal(result.concepts[0].name, 'Cellular respiration')
    assert.equal(requestOptions.headers.Authorization, 'Bearer test-key')
    assert.equal(JSON.parse(requestOptions.body).messages[1].content.includes(sourceText), true)
  })
})

test('reports missing provider configuration instead of returning generated fallback analysis', async () => {
  const previousKey = process.env.OPENAI_API_KEY
  const previousModel = process.env.OPENAI_MODEL
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_MODEL
  try {
    await assert.rejects(
      createAnalysisAi().analyzeChunk({ pages: [{
        pageNumber: 1,
        originalText: sourceText,
      }] }),
      AnalysisConfigurationError,
    )
  } finally {
    if (previousKey !== undefined) process.env.OPENAI_API_KEY = previousKey
    if (previousModel !== undefined) process.env.OPENAI_MODEL = previousModel
  }
})
