import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  LoaderCircle,
  Network,
  RotateCcw,
  Sparkles,
  Table as TableIcon,
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
  const [activeTab, setActiveTab] = useState('concepts')
  const [selectedPageNum, setSelectedPageNum] = useState(1)

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
        {document && (
          <div className="flex items-center gap-2">
            <Link
              to={`/app/papers/${encodeURIComponent(documentId)}/learn`}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <BookOpen size={14} /> Open Learning Workspace
            </Link>
            <Link
              to={`/app/papers/${encodeURIComponent(documentId)}/visuals`}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <ImageIcon size={14} /> Visual Explanations
            </Link>
            <span className={`analysis-status-pill analysis-status-${status.toLowerCase()}`}>
              {isComplete ? <CheckCircle2 size={15} /> : isActive ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}
              {status === 'NOT_STARTED' ? 'Ready to analyze' : status.replaceAll('_', ' ').toLowerCase()}
            </span>
          </div>
        )}
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
              {/* Top Overview Cards */}
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
                <div className="analysis-subject-card">
                  <span className="analysis-stat-icon" style={{ background: '#fef3c7', color: '#b45309' }}><Layers size={17} /></span>
                  <div><small>EXTRACTED PAGES</small><strong>{analysis.pages?.length || 0} pages</strong></div>
                </div>
              </section>

              {/* Navigation Tabs */}
              <div className="flex gap-2 border-b border-border mb-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('concepts')}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                    activeTab === 'concepts'
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-text-muted hover:text-text-main'
                  }`}
                >
                  <BookOpen size={16} /> Grounded Concepts ({analysis.concepts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('structure')}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                    activeTab === 'structure'
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-text-muted hover:text-text-main'
                  }`}
                >
                  <Layers size={16} /> Document Structure & Pages ({analysis.pages?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('visuals')}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                    activeTab === 'visuals'
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-text-muted hover:text-text-main'
                  }`}
                >
                  <TableIcon size={16} /> Visuals & Tables
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('relationships')}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                    activeTab === 'relationships'
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-text-muted hover:text-text-main'
                  }`}
                >
                  <Network size={16} /> Concept Relationships ({analysis.relationships.length})
                </button>
              </div>

              {/* TAB 1: Grounded Concepts & Topics */}
              {activeTab === 'concepts' && (
                <>
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
                </>
              )}

              {/* TAB 2: Document Structure & Pages */}
              {activeTab === 'structure' && (
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left: Page Navigator */}
                  <div className="bg-surface rounded-xl border border-border p-4 shadow-sm h-fit">
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Extracted Pages</h4>
                    <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                      {(analysis.pages || []).map((page) => (
                        <button
                          key={page.pageNumber}
                          type="button"
                          onClick={() => setSelectedPageNum(page.pageNumber)}
                          className={`w-full text-left p-3 rounded-lg border text-sm transition-all flex items-center justify-between ${
                            selectedPageNum === page.pageNumber
                              ? 'bg-brand-50 border-brand-300 text-brand-900 font-medium'
                              : 'border-border/60 hover:bg-surface-muted text-text-main'
                          }`}
                        >
                          <div className="truncate">
                            <span className="text-xs font-bold text-brand-600 block">Page {page.pageNumber}</span>
                            <span className="truncate text-xs text-text-muted">{page.section || 'General Content'}</span>
                          </div>
                          {(page.tables?.length > 0 || page.headings?.length > 0) && (
                            <span className="text-[10px] bg-surface-muted px-1.5 py-0.5 rounded text-text-muted border">
                              {page.headings?.length ? `${page.headings.length} H` : ''}
                              {page.tables?.length ? ` · ${page.tables.length} T` : ''}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right: Selected Page Details */}
                  <div className="md:col-span-2 space-y-4">
                    {(() => {
                      const page = (analysis.pages || []).find((p) => p.pageNumber === selectedPageNum) || analysis.pages?.[0]
                      if (!page) {
                        return <div className="analysis-empty"><FileText size={20} /><strong>No page data extracted</strong></div>
                      }
                      return (
                        <div className="bg-surface rounded-xl border border-border p-6 shadow-sm space-y-5">
                          <div className="flex items-center justify-between border-b border-border pb-4">
                            <div>
                              <span className="text-xs font-semibold text-brand-600 uppercase">Page {page.pageNumber}</span>
                              <h3 className="text-lg font-bold text-text-main">{page.section || 'Section Content'}</h3>
                            </div>
                            <a
                              href={`/api/documents/${encodeURIComponent(documentId)}/file#page=${page.pageNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium bg-brand-50 px-2.5 py-1.5 rounded-md"
                            >
                              <FileText size={13} /> View Page in PDF <ArrowUpRight size={13} />
                            </a>
                          </div>

                          {/* Headings */}
                          {page.headings?.length > 0 && (
                            <div>
                              <h5 className="text-xs font-bold uppercase text-text-muted mb-2">Detected Headings</h5>
                              <div className="flex flex-wrap gap-2">
                                {page.headings.map((h, i) => (
                                  <span key={i} className="px-2.5 py-1 rounded bg-surface-muted border border-border text-xs font-medium text-text-main">
                                    {h}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Definitions */}
                          {page.definitions?.length > 0 && (
                            <div>
                              <h5 className="text-xs font-bold uppercase text-text-muted mb-2">Detected Definitions</h5>
                              <ul className="space-y-1.5">
                                {page.definitions.map((def, i) => (
                                  <li key={i} className="text-xs text-text-main bg-brand-50/50 p-2.5 rounded border border-brand-100">
                                    {def}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Important Terms */}
                          {page.importantTerms?.length > 0 && (
                            <div>
                              <h5 className="text-xs font-bold uppercase text-text-muted mb-2">Important Terms</h5>
                              <div className="flex flex-wrap gap-1.5">
                                {page.importantTerms.map((term, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 font-medium">
                                    {term}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Extracted Text Excerpt */}
                          <div>
                            <h5 className="text-xs font-bold uppercase text-text-muted mb-2">Extracted Page Text</h5>
                            <pre className="text-xs bg-surface-muted p-4 rounded-lg font-mono text-text-main whitespace-pre-wrap max-h-[300px] overflow-y-auto border border-border/80">
                              {page.originalText}
                            </pre>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </section>
              )}

              {/* TAB 3: Visuals & Tables */}
              {activeTab === 'visuals' && (
                <div className="space-y-6">
                  {/* Extracted Tables Section */}
                  <div className="bg-surface rounded-xl border border-border p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <TableIcon className="text-brand-600" size={18} />
                      <h4 className="font-bold text-text-main">Extracted Tables</h4>
                    </div>
                    {(() => {
                      const allTables = (analysis.pages || []).flatMap((p) => (p.tables || []).map((t) => ({ ...t, pageNumber: p.pageNumber })))
                      if (!allTables.length) {
                        return <p className="text-sm text-text-muted">No structured tables were detected in this document.</p>
                      }
                      return (
                        <div className="space-y-6">
                          {allTables.map((tbl, idx) => (
                            <div key={idx} className="border border-border rounded-lg p-4 bg-surface-muted/30">
                              <span className="text-xs font-bold text-brand-600 block mb-2">Table on Page {tbl.pageNumber}</span>
                              {tbl.header?.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-border bg-surface-muted">
                                        {tbl.header.map((col, colIdx) => (
                                          <th key={colIdx} className="p-2 font-semibold text-text-main">{col}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(tbl.rows || []).map((row, rowIdx) => (
                                        <tr key={rowIdx} className="border-b border-border/50 hover:bg-surface-muted/40">
                                          {row.map((cell, cellIdx) => (
                                            <td key={cellIdx} className="p-2 text-text-main">{cell}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Detected Visual Content Section */}
                  <div className="bg-surface rounded-xl border border-border p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <ImageIcon className="text-violet-600" size={18} />
                      <h4 className="font-bold text-text-main">Visual Content & Illustrations</h4>
                    </div>
                    <p className="text-xs text-text-muted mb-4">
                      KNOWFLOW scans all pages for diagrams, flowcharts, graphs, maps, and figures to preserve visual anchors for learning.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {(analysis.pages || []).map((p) => (
                        <div key={p.pageNumber} className="border border-border rounded-lg p-3.5 bg-surface-muted/30 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-text-main">Page {p.pageNumber}</span>
                            <span className="text-xs text-text-muted block truncate max-w-[180px]">{p.section}</span>
                          </div>
                          <a
                            href={`/api/documents/${encodeURIComponent(documentId)}/file#page=${p.pageNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium bg-brand-50 px-2 py-1 rounded"
                          >
                            Inspect <ArrowUpRight size={12} />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Concept Relationships */}
              {activeTab === 'relationships' && (
                <section className="analysis-section">
                  <div className="analysis-section-heading"><div><span className="eyebrow">HOW IDEAS CONNECT</span><h3>Concept relationships</h3></div></div>
                  {analysis.relationships.length > 0 ? (
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
                  ) : (
                    <div className="analysis-empty"><Network size={22} /><strong>No explicit relationships identified</strong><p>Relationships between concepts will be formed as additional connected documents are analyzed.</p></div>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
