/**
 * Document Retrieval Engine for KNOWFLOW Phase 6.
 * Implements chunking, BM25/TF-IDF hybrid ranking, exact phrase matching,
 * and contextual multi-modal retrieval (text, tables, diagrams, topic materials).
 */

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as',
  'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t',
  'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he',
  'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
  'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only',
  'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d',
  'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re',
  'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we',
  'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s',
  'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you',
  'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'tell', 'explain', 'please',
  'give', 'show', 'mean', 'meaning'
])

export function tokenize(text) {
  if (!text) return []
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
}

/**
 * Builds search chunks from all document sources:
 * - ExtractedPages (text, headings, paragraphs, tables)
 * - DocumentVisuals (diagrams, flowcharts, maps, etc.)
 * - TopicLearningMaterials (structured notes, definitions)
 * - Concepts
 */
export function buildDocumentChunks({
  documentId,
  pages = [],
  visuals = [],
  topics = [],
  materials = [],
  concepts = [],
}) {
  const chunks = []

  // 1. Chunks from Extracted Pages
  for (const page of pages) {
    const pageNum = page.pageNumber
    const section = page.section || 'General'

    // Heading-level or Paragraph Chunks
    const paragraphs = Array.isArray(page.paragraphs) ? page.paragraphs : []
    if (paragraphs.length > 0) {
      // Group paragraphs into manageable ~400-word chunks
      let currentChunkText = ''
      let pIdx = 0
      for (const p of paragraphs) {
        if (!p || typeof p !== 'string') continue
        if ((currentChunkText + '\n' + p).split(/\s+/).length > 250 && currentChunkText.length > 0) {
          chunks.push({
            id: `page-${pageNum}-text-${pIdx++}`,
            documentId,
            pageNumber: pageNum,
            section,
            type: 'TEXT',
            title: page.headings?.[0] || `Page ${pageNum} Section`,
            content: currentChunkText.trim(),
            keywords: tokenize(currentChunkText + ' ' + section),
          })
          currentChunkText = p
        } else {
          currentChunkText += (currentChunkText ? '\n\n' : '') + p
        }
      }
      if (currentChunkText.trim()) {
        chunks.push({
          id: `page-${pageNum}-text-${pIdx}`,
          documentId,
          pageNumber: pageNum,
          section,
          type: 'TEXT',
          title: page.headings?.[0] || `Page ${pageNum} Section`,
          content: currentChunkText.trim(),
          keywords: tokenize(currentChunkText + ' ' + section),
        })
      }
    } else if (page.originalText?.trim()) {
      // Fallback: chunk original text
      chunks.push({
        id: `page-${pageNum}-raw`,
        documentId,
        pageNumber: pageNum,
        section,
        type: 'TEXT',
        title: page.headings?.[0] || `Page ${pageNum}`,
        content: page.originalText.trim(),
        keywords: tokenize(page.originalText + ' ' + section),
      })
    }

    // Table Chunks from Page
    const tables = Array.isArray(page.tables) ? page.tables : []
    for (let tIdx = 0; tIdx < tables.length; tIdx++) {
      const table = tables[tIdx]
      const tableContent = typeof table === 'string' ? table : JSON.stringify(table)
      chunks.push({
        id: `page-${pageNum}-table-${tIdx}`,
        documentId,
        pageNumber: pageNum,
        section,
        type: 'TABLE',
        title: `Table on Page ${pageNum}`,
        content: `Table on Page ${pageNum} under section "${section}":\n${tableContent}`,
        keywords: tokenize(tableContent + ' table ' + section),
      })
    }

    // Definitions from Page
    const defs = Array.isArray(page.definitions) ? page.definitions : []
    for (let dIdx = 0; dIdx < defs.length; dIdx++) {
      const def = defs[dIdx]
      const defContent = typeof def === 'string' ? def : `${def.term}: ${def.definition}`
      chunks.push({
        id: `page-${pageNum}-def-${dIdx}`,
        documentId,
        pageNumber: pageNum,
        section,
        type: 'DEFINITION',
        title: `Definition on Page ${pageNum}`,
        content: defContent,
        keywords: tokenize(defContent + ' definition term ' + section),
      })
    }
  }

  // 2. Chunks from Document Visuals (Diagrams, Flowcharts, Maps, Charts)
  for (const vis of visuals) {
    const partsStr = Array.isArray(vis.partsExplanation)
      ? vis.partsExplanation.map((p) => (typeof p === 'string' ? p : `${p.name || ''}: ${p.description || ''}`)).join('; ')
      : ''
    const labelsStr = Array.isArray(vis.labelsExplanation)
      ? vis.labelsExplanation.map((l) => (typeof l === 'string' ? l : `${l.label || ''}: ${l.meaning || ''}`)).join('; ')
      : ''
    const arrowsStr = typeof vis.arrowsExplanation === 'string'
      ? vis.arrowsExplanation
      : (Array.isArray(vis.arrowsExplanation) ? vis.arrowsExplanation.map((a) => (typeof a === 'string' ? a : `${a.from} -> ${a.to}: ${a.meaning}`)).join('; ') : '')
    const stepsStr = Array.isArray(vis.stepByStepProcess) ? vis.stepByStepProcess.join('; ') : ''
    const wordsStr = Array.isArray(vis.difficultWords)
      ? vis.difficultWords.map((w) => (typeof w === 'string' ? w : `${w.word || w.term}: ${w.simpleMeaning || ''}`)).join('; ')
      : ''

    const visText = [
      `Visual Title: ${vis.title}`,
      `Type: ${vis.type || 'DIAGRAM'}`,
      `Represents: ${vis.whatItRepresents || ''}`,
      `Purpose: ${vis.purpose || ''}`,
      partsStr ? `Parts: ${partsStr}` : '',
      labelsStr ? `Labels: ${labelsStr}` : '',
      arrowsStr ? `Arrows and Flow: ${arrowsStr}` : '',
      stepsStr ? `Steps: ${stepsStr}` : '',
      vis.easyExample ? `Example / Analogy: ${typeof vis.easyExample === 'string' ? vis.easyExample : JSON.stringify(vis.easyExample)}` : '',
      wordsStr ? `Difficult Words: ${wordsStr}` : '',
    ].filter(Boolean).join('\n')

    chunks.push({
      id: `visual-${vis.id}`,
      documentId,
      pageNumber: vis.pageNumber,
      section: vis.title,
      type: 'VISUAL',
      title: vis.title,
      visualType: vis.type || 'DIAGRAM',
      content: visText,
      keywords: tokenize(visText + ' diagram flowchart visual figure chart map illustration'),
    })
  }

  // 3. Chunks from Topic Learning Materials
  for (const mat of materials) {
    const matText = [
      `Topic: ${mat.topicTitle}`,
      mat.chapterTitle ? `Chapter: ${mat.chapterTitle}` : '',
      `Simple Definition: ${mat.simpleDefinition || ''}`,
      `Easy Explanation: ${mat.easyExplanation || ''}`,
      `Detailed Explanation: ${mat.detailedExplanation || ''}`,
      mat.stepByStepExplanation?.length ? `Step-by-Step: ${mat.stepByStepExplanation.join('; ')}` : '',
      mat.realWorldExample ? `Real-World Example: ${mat.realWorldExample}` : '',
      mat.importantPoints?.length ? `Important Points: ${mat.importantPoints.join('; ')}` : '',
    ].filter(Boolean).join('\n')

    const firstPage = mat.pageReferences?.[0] || 1
    chunks.push({
      id: `topic-${mat.topicId || mat.id}`,
      documentId,
      pageNumber: firstPage,
      pageReferences: mat.pageReferences || [firstPage],
      section: mat.chapterTitle || mat.topicTitle,
      type: 'TOPIC',
      title: mat.topicTitle,
      content: matText,
      keywords: tokenize(matText + ' ' + (mat.chapterTitle || '')),
    })
  }

  // 4. Chunks from Concept Map
  for (const c of concepts) {
    const firstSource = c.sources?.[0] || c.sourceReferences?.[0]
    const pageNum = firstSource?.pageNumber || 1
    const conceptText = [
      `Concept: ${c.name}`,
      `Definition: ${c.definition || ''}`,
      `Explanation: ${c.detailedExplanation || c.simpleExplanation || ''}`,
      c.examples?.length ? `Examples: ${c.examples.join(', ')}` : '',
      c.formulas?.length ? `Formulas: ${c.formulas.join(', ')}` : '',
      c.importantFacts?.length ? `Important Facts: ${c.importantFacts.join(', ')}` : '',
    ].filter(Boolean).join('\n')

    chunks.push({
      id: `concept-${c.id}`,
      documentId,
      pageNumber: pageNum,
      section: c.name,
      type: 'CONCEPT',
      title: c.name,
      content: conceptText,
      keywords: tokenize(conceptText + ' ' + c.name),
    })
  }

  return chunks
}

/**
 * Ranks and retrieves the top-k chunks relevant to query and context.
 */
export function retrieveRelevantChunks(query, chunks, options = {}) {
  const {
    topK = 5,
    activeTopicId = null,
    recentHistory = [],
    minScoreThreshold = 0.4,
  } = options

  if (!query || chunks.length === 0) {
    return { chunks: [], isOutOfScope: true, topScore: 0 }
  }

  const queryTokens = tokenize(query)
  const lowerQuery = query.toLowerCase()

  // Detect query intent / modalities
  const isDiagramQuery = /diagram|figure|flowchart|chart|graph|map|arrow|visual|illustration|image/i.test(query)
  const isTableQuery = /table|column|row|data sheet|metrics|comparison table/i.test(query)
  const isDefinitionQuery = /what is|what are|define|definition|meaning of|what does .* mean/i.test(query)
  const isStepQuery = /step by step|how does .* work|process|sequence|procedure/i.test(query)
  const isExampleQuery = /example|analogy|scenario|instance|like what/i.test(query)
  const isRevisionQuery = /revision|summary|recap|key points|bullet points|important points/i.test(query)
  const isFollowUpQuery = /explain that simpler|simpler|simply|more simple|what about that|and then|what did you mean|tell me more|easy/i.test(query)

  // Context tokens from recent assistant responses for follow-up resolution
  const contextTokens = isFollowUpQuery && recentHistory.length > 0
    ? tokenize(recentHistory.slice(-2).map((m) => m.content).join(' '))
    : []

  // Document-wide term frequency calculation for BM25 IDF
  const totalChunks = chunks.length
  const docFreq = new Map()
  for (const token of queryTokens) {
    let count = 0
    for (const chunk of chunks) {
      if (chunk.keywords.includes(token)) count++
    }
    docFreq.set(token, count)
  }

  // Score each chunk
  const scoredChunks = []

  for (const chunk of chunks) {
    let score = 0
    const lowerContent = chunk.content.toLowerCase()
    const lowerTitle = (chunk.title || '').toLowerCase()
    const lowerSection = (chunk.section || '').toLowerCase()

    // 1. Exact phrase matching bonus
    if (query.length > 4 && lowerContent.includes(query.trim().toLowerCase())) {
      score += 8.0
    }

    // 2. Title and Section match bonus
    for (const token of queryTokens) {
      if (lowerTitle.includes(token)) score += 3.5
      if (lowerSection.includes(token)) score += 2.0
    }

    // 3. BM25 / TF-IDF scoring for query tokens
    for (const token of queryTokens) {
      const freqInChunk = chunk.keywords.filter((k) => k === token).length
      if (freqInChunk > 0) {
        const df = docFreq.get(token) || 1
        const idf = Math.log((totalChunks - df + 0.5) / (df + 0.5) + 1)
        const tf = (freqInChunk * 2.2) / (freqInChunk + 1.2 * (0.25 + 0.75 * (chunk.keywords.length / 50)))
        score += tf * Math.max(idf, 0.2)
      }
    }

    // 4. Modality-specific boosts
    if (isDiagramQuery && chunk.type === 'VISUAL') score *= 2.5
    if (isTableQuery && chunk.type === 'TABLE') score *= 2.5
    if (isDefinitionQuery && (chunk.type === 'DEFINITION' || chunk.type === 'CONCEPT')) score *= 1.8

    // 5. Active topic affinity
    if (activeTopicId && chunk.id.includes(activeTopicId)) {
      score *= 1.3
    }

    // 6. Follow-up context affinity
    if (isFollowUpQuery && contextTokens.length > 0) {
      let contextMatches = 0
      for (const ct of contextTokens) {
        if (chunk.keywords.includes(ct)) contextMatches++
      }
      score += contextMatches * 0.4
    }

    if (score > 0) {
      scoredChunks.push({
        ...chunk,
        score,
        // Short excerpt for preview
        excerpt: chunk.content.slice(0, 200).replace(/\n+/g, ' '),
      })
    }
  }

  // Sort descending by relevance score
  scoredChunks.sort((a, b) => b.score - a.score)

  const topChunks = scoredChunks.slice(0, topK)
  const topScore = topChunks[0]?.score || 0
  const isOutOfScope = topScore < minScoreThreshold

  return {
    chunks: topChunks,
    topScore,
    isOutOfScope,
    queryIntent: {
      isDiagramQuery,
      isTableQuery,
      isDefinitionQuery,
      isStepQuery,
      isExampleQuery,
      isRevisionQuery,
      isFollowUpQuery,
    },
  }
}
