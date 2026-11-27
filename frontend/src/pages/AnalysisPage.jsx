import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  FileText,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Waypoints,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'

const activeStatuses = new Set(['QUEUED', 'PROCESSING'])

function SourceReference({ reference }) {
  const documentId = reference.documentId
  const href = `/api/documents/${encodeURIComponent(documentId)}/file#page=${reference.pageNumber}`

  return (
    <a className="analysis-source" href={href} target="_blank" rel="noopener noreferrer">
      <FileText size={14} />
      <span><strong>Page {reference.pageNumber}</strong><q>{reference.excerpt}</q></span>
      <ArrowUpRight size={14} />
    </a>
  )
}

function ConceptCard({ concept }) {
  const firstSource = concept.sourceReferences[0]
  const sourceContext = firstSource?.context || {}
  const definition = sourceContext.definition || concept.definition
  const explanation = sourceContext.explanation || concept.detailedExplanation
  const examples = sourceContext.examples?.length ? sourceContext.examples : concept.examples
  const formulas = sourceContext.formulas?.length ? sourceContext.formulas : concept.formulas
  const facts = sourceContext.importantFacts?.length ? sourceContext.importantFacts : concept.importantFacts

  return (
    <motion.article className="analysis-concept-card" layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="analysis-concept-heading">
        <span className="analysis-concept-icon"><BookOpen size={17} /></span>
        <h4>{concept.name}</h4>
      </div>
      <p className="analysis-definition">{definition}</p>
      <p className="analysis-explanation">{explanation}</p>
      {examples.length > 0 && (
        <div className="analysis-detail-group"><strong>Examples</strong><ul>{examples.map((item) => <li key={item}>{item}</li>)}</ul></div>
      )}
      {formulas.length > 0 && (
        <div className="analysis-formulas"><strong>Formulas</strong>{formulas.map((formula) => <code key={formula}>{formula}</code>)}</div>
      )}
      {facts.length > 0 && (
        <div className="analysis-detail-group"><strong>Important facts</strong><ul>{facts.map((item) => <li key={item}>{item}</li>)}</ul></div>
      )}
      <div className="analysis-sources">
        <strong>From your document</strong>
        {concept.sourceReferences.map((reference) => (
          <SourceReference
            key={`${reference.documentId}:${reference.pageNumber}:${reference.excerpt}`}
            reference={reference}
          />
        ))}
      </div>
    </motion.article>
  )
}

export default function AnalysisPage() {
  const { documentId } = useParams()
  const [loaded, setLoaded] = useState(null)
  const loadedDocumentId = useRef(null)
  const [starting, setStarting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    let timer
    const controller = new AbortController()

    async function loadAnalysis() {
      try {
        const result = await apiRequest(`/api/analysis/${encodeURIComponent(documentId)}`, {
          signal: controller.signal,
        })
        if (!active) return
        loadedDocumentId.current = documentId
        setLoaded({ documentId, document: result.document, analysis: result.analysis })
        setLoadError('')
        if (activeStatuses.has(result.analysis?.status)) {
          timer = window.setTimeout(loadAnalysis, 1600)
        }
      } catch (requestError) {
        if (active && !controller.signal.aborted) {
          setLoadError(requestError.message)
          if (loadedDocumentId.current !== documentId) {
            loadedDocumentId.current = documentId
            setLoaded({ documentId, document: null, analysis: null })
          }
        }
      }
    }

    loadAnalysis()
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [documentId, refreshKey])

  async function startAnalysis() {
    setStarting(true)
    setLoadError('')
    try {
      await apiRequest(`/api/analysis/${encodeURIComponent(documentId)}`, { method: 'POST' })
      setRefreshKey((current) => current + 1)
    } catch (requestError) {
      setLoadError(requestError.message)
    } finally {
      setStarting(false)
    }
  }

  const current = loaded?.documentId === documentId ? loaded : null
  const document = current?.document
  const analysis = current?.analysis
  const loading = !current
  const error = loading ? '' : loadError
  const status = analysis?.status || 'NOT_STARTED'
  const isActive = activeStatuses.has(status)
  const isComplete = status === 'COMPLETED'
  const isFailed = status === 'FAILED'

  return (
    <div className="analysis-page">
      <Link className="analysis-back-link" to="/app/papers"><ArrowLeft size={15} /> Back to My Papers</Link>
      <header className="analysis-page-heading">
        <div>
          <span className="eyebrow">DOCUMENT UNDERSTANDING</span>
          <h2>{document?.fileName || 'Paper analysis'}</h2>
          <p>Explore the topics and concepts KNOWFLOW found in your study material.</p>
        </div>
        {document && <span className={`analysis-status-pill analysis-status-${status.toLowerCase()}`}>
          {isComplete ? <CheckCircle2 size={15} /> : isActive ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}
          {status === 'NOT_STARTED' ? 'Ready to analyze' : status.replaceAll('_', ' ').toLowerCase()}
        </span>}
      </header>

      {error && <div className="analysis-alert" role="alert"><AlertCircle size={16} />{error}</div>}

      {loading ? (
        <div className="analysis-loading"><LoaderCircle className="spin" size={24} /><span>Opening your analysis…</span></div>
      ) : !document ? (
        <div className="analysis-empty">
          <AlertCircle size={22} />
          <strong>We couldn’t open this paper</strong>
          <p>Return to My Papers and try opening it again.</p>
        </div>
      ) : !analysis ? (
        <section className="analysis-start-card">
          <span className="analysis-start-art"><Sparkles size={24} /></span>
          <div>
            <span className="eyebrow">READY WHEN YOU ARE</span>
            <h3>Understand the ideas inside this paper.</h3>
            <p>KNOWFLOW will read the actual page text, organize its topics, and connect concepts to passages in the PDF.</p>
          </div>
          <button type="button" className="button button-primary" onClick={startAnalysis} disabled={starting}>
            {starting ? <><LoaderCircle className="spin" size={15} /> Starting…</> : <><Sparkles size={15} /> Analyze paper</>}
          </button>
        </section>
      ) : (
        <>
          {analysis && (
            <section className={`analysis-progress-card${isFailed ? ' analysis-progress-failed' : ''}`} aria-live="polite">
              <span className="analysis-progress-icon">
                {isComplete ? <CheckCircle2 size={20} /> : isFailed ? <AlertCircle size={20} /> : <Sparkles size={20} />}
              </span>
              <div className="analysis-progress-copy">
                <strong>{isComplete ? 'Analysis complete' : isFailed ? 'Analysis needs attention' : analysis.stage || 'Preparing analysis'}</strong>
                <span>{isFailed ? analysis.error : isComplete ? `We found ${analysis.topics.length} topics and ${analysis.concepts.length} concepts.` : 'Reading page structure and connecting ideas from your document.'}</span>
                {!isFailed && (
                  <div
                    className="analysis-progress-track"
                    role="progressbar"
                    aria-label="Analysis progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={analysis.progress}
                  >
                    <i style={{ width: `${analysis.progress}%` }} />
                  </div>
                )}
              </div>
              {isFailed && (
                <button type="button" className="button button-outline" onClick={startAnalysis} disabled={starting}>
                  {starting ? <LoaderCircle className="spin" size={15} /> : <RotateCcw size={15} />}
                  Retry
                </button>
              )}
            </section>
          )}

          {isComplete && (
            <>
              <section className="analysis-overview">
                <div className="analysis-subject-card">
                  <span className="analysis-stat-icon"><Sparkles size={17} /></span>
                  <div><small>SUBJECT</small><strong>{analysis.subject || 'Not identified'}</strong></div>
                </div>
                <div className="analysis-subject-card">
                  <span className="analysis-stat-icon analysis-stat-violet"><Waypoints size={17} /></span>
                  <div><small>TOPICS & SUBTOPICS</small><strong>{analysis.topics.length} topics · {analysis.topics.reduce((total, topic) => total + topic.subtopics.length, 0)} subtopics</strong></div>
                </div>
                <div className="analysis-subject-card">
                  <span className="analysis-stat-icon analysis-stat-mint"><BookOpen size={17} /></span>
                  <div><small>GROUNDED CONCEPTS</small><strong>{analysis.concepts.length} concepts</strong></div>
                </div>
              </section>

              {analysis.topics.length > 0 && (
                <section className="analysis-section">
                  <div className="analysis-section-heading"><div><span className="eyebrow">THE BIG PICTURE</span><h3>Topics in this paper</h3></div></div>
                  <div className="analysis-topic-grid">
                    {analysis.topics.map((topic) => (
                      <article className="analysis-topic-card" key={topic.id}>
                        <span className="analysis-topic-marker"><Waypoints size={16} /></span>
                        <h4>{topic.name}</h4>
                        <p>{topic.description}</p>
                        {topic.subtopics.length > 0 && (
                          <ul>{topic.subtopics.map((subtopic) => <li key={subtopic.id}>{subtopic.name}<span>{subtopic.description}</span></li>)}</ul>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {analysis.concepts.length > 0 ? (
                <section className="analysis-section">
                  <div className="analysis-section-heading"><div><span className="eyebrow">IDEAS WORTH KEEPING</span><h3>Concepts with page references</h3></div></div>
                  <div className="analysis-concept-grid">
                    {analysis.concepts.map((concept) => <ConceptCard concept={concept} key={concept.id} />)}
                  </div>
                </section>
              ) : (
                <div className="analysis-empty"><BookOpen size={22} /><strong>No concepts were identified</strong><p>The document was read, but the analysis did not find supported concepts to save.</p></div>
              )}

              {analysis.relationships.length > 0 && (
                <section className="analysis-section">
                  <div className="analysis-section-heading"><div><span className="eyebrow">HOW IDEAS CONNECT</span><h3>Concept relationships</h3></div></div>
                  <div className="analysis-relationship-list">
                    {analysis.relationships.map((relationship) => (
                      <article className="analysis-relationship" key={relationship.id}>
                        <span className="analysis-relationship-node">{relationship.fromConcept.name}</span>
                        <span className="analysis-relationship-edge"><i />{relationship.type.replaceAll('_', ' ').toLowerCase()}<i /></span>
                        <span className="analysis-relationship-node">{relationship.toConcept.name}</span>
                        <p>{relationship.evidence} <small>Page{relationship.sourcePageNumbers.length === 1 ? '' : 's'} {relationship.sourcePageNumbers.join(', ')}</small></p>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
