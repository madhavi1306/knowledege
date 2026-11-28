import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Lightbulb,
  ListOrdered,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  Minus,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Table as TableIcon,
  Waypoints,
  X,
  ZoomIn,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import MermaidDiagram from '../components/MermaidDiagram.jsx'
import { apiRequest } from '../services/api.js'

const visualTypeConfig = {
  DIAGRAM: { label: 'Technical Diagram', icon: Network, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  FLOWCHART: { label: 'Process Flowchart', icon: Waypoints, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MAP: { label: 'Conceptual Map', icon: Layers, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  GRAPH: { label: 'Graph / Chart', icon: LayoutGrid, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  CHART: { label: 'Chart', icon: LayoutGrid, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  TABLE: { label: 'Structured Table', icon: TableIcon, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  ILLUSTRATION: { label: 'Illustration', icon: ImageIcon, color: 'bg-rose-50 text-rose-700 border-rose-200' },
  ARCHITECTURE: { label: 'Architecture Diagram', icon: Network, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
}

export default function VisualLearningWorkspacePage() {
  const { documentId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [document, setDocument] = useState(null)
  const [visuals, setVisuals] = useState([])
  const [activeVisual, setActiveVisual] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  // View state
  const [visualMode, setVisualMode] = useState('split') // 'original', 'simplified', 'split'
  const [zoomLevel, setZoomLevel] = useState(100)
  const [filterType, setFilterType] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGlossaryTerm, setSelectedGlossaryTerm] = useState(null)
  const [imageError, setImageError] = useState(false)

  // Visual Q&A state
  const [questionInput, setQuestionInput] = useState('')
  const [asking, setAsking] = useState(false)
  const [qaHistory, setQaHistory] = useState([])

  // 1. Load Visuals list
  async function loadVisuals(targetVisualId = null) {
    try {
      setLoading(true)
      const data = await apiRequest(`/api/visuals/${encodeURIComponent(documentId)}`)
      setDocument(data.document)
      setVisuals(data.visuals || [])
      setError('')

      const visualToSelect = targetVisualId || searchParams.get('visualId') || data.visuals?.[0]?.id
      if (visualToSelect) {
        loadVisualDetail(visualToSelect)
      }
    } catch (err) {
      setError(err.message || 'Failed to load document visuals.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Load detailed visual explanation
  async function loadVisualDetail(visualId) {
    if (!visualId) return
    setDetailLoading(true)
    setSelectedGlossaryTerm(null)
    setQaHistory([])
    setZoomLevel(100)
    setImageError(false)
    try {
      const data = await apiRequest(`/api/visuals/${encodeURIComponent(documentId)}/${encodeURIComponent(visualId)}`)
      setActiveVisual(data.visual)
      setVisualMode(data.visual.status === 'COMPLETED' ? 'split' : 'original')
      setSearchParams({ visualId })
    } catch (err) {
      setError(err.message || 'Failed to load visual explanation.')
    } finally {
      setDetailLoading(false)
    }
  }

  // 3. Ask question about the active visual
  async function handleAskQuestion(customQuestion = null) {
    const q = (customQuestion || questionInput).trim()
    if (!q || !activeVisual || activeVisual.status !== 'COMPLETED' || asking) return

    setAsking(true)
    const userMsg = { role: 'user', content: q, timestamp: new Date().toISOString() }
    setQaHistory((prev) => [...prev, userMsg])
    if (!customQuestion) setQuestionInput('')

    try {
      const res = await apiRequest(`/api/visuals/${encodeURIComponent(documentId)}/${encodeURIComponent(activeVisual.id)}/ask`, {
        method: 'POST',
        body: { question: q },
      })
      const botMsg = {
        role: 'assistant',
        content: res.answer,
        citations: res.citations || [],
        timestamp: new Date().toISOString(),
      }
      setQaHistory((prev) => [...prev, botMsg])
    } catch (err) {
      const errorMsg = {
        role: 'assistant',
        content: `Error answering question: ${err.message}`,
        error: true,
        timestamp: new Date().toISOString(),
      }
      setQaHistory((prev) => [...prev, errorMsg])
    } finally {
      setAsking(false)
    }
  }

  useEffect(() => {
    loadVisuals()
  }, [documentId])

  // Filtered visuals
  const filteredVisuals = visuals.filter((v) => {
    const matchesType = filterType === 'ALL' || (v.type || v.visualType) === filterType
    const matchesSearch = !searchQuery.trim() ||
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.pageNumber.toString().includes(searchQuery)
    return matchesType && matchesSearch
  })

  const visualTypesAvailable = Array.from(new Set(visuals.map((v) => v.type || v.visualType)))

  // Robust field normalization
  const parts = activeVisual?.partsExplanation?.length ? activeVisual.partsExplanation : (activeVisual?.parts || [])
  const labels = activeVisual?.labelsExplanation?.length ? activeVisual.labelsExplanation : (activeVisual?.labels || [])
  const arrowsList = Array.isArray(activeVisual?.arrowsExplanation)
    ? activeVisual.arrowsExplanation
    : (Array.isArray(activeVisual?.arrows) ? activeVisual.arrows : [])
  const arrowsText = typeof activeVisual?.arrowsExplanation === 'string'
    ? activeVisual.arrowsExplanation
    : (typeof activeVisual?.arrows === 'string' ? activeVisual.arrows : null)
  const steps = activeVisual?.stepByStepProcess || []
  const difficultWords = activeVisual?.difficultWords || []
  const connections = activeVisual?.connections || []
  const importantPoints = activeVisual?.importantPoints || []

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/app/papers"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft size={14} /> Back to Papers
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                <Sparkles size={12} /> Phase 5 Visual Explanation
              </span>
              <h1 className="text-base font-bold text-slate-900 line-clamp-1">
                {document?.fileName || 'Document Visuals'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/app/papers/${encodeURIComponent(documentId)}/learn`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors"
            >
              <BookOpen size={14} /> Structured Notes
            </Link>
            <Link
              to={`/app/papers/${encodeURIComponent(documentId)}/analysis`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Layers size={14} /> Analysis Overview
            </Link>
            <a
              href={`/api/documents/${encodeURIComponent(documentId)}/file${activeVisual ? `#page=${activeVisual.pageNumber}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <ExternalLink size={14} /> View PDF
            </a>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto w-full flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visuals Catalog & Selector */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon size={16} className="text-indigo-600" />
                Document Visuals ({visuals.length})
              </h2>
              <button
                type="button"
                onClick={() => loadVisuals(activeVisual?.id)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
                title="Refresh visual catalog"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search diagrams, flowcharts, tables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
              />
            </div>

            {/* Filter Tags */}
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterType === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({visuals.length})
              </button>
              {visualTypesAvailable.map((type) => {
                const conf = visualTypeConfig[type] || visualTypeConfig.DIAGRAM
                const count = visuals.filter((v) => (v.type || v.visualType) === type).length
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFilterType(type)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      filterType === type
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {conf.label.split(' ')[0]} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {/* Visuals List */}
          <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <LoaderCircle className="animate-spin text-indigo-600" size={24} />
                <span className="text-xs">Extracting and analyzing visuals…</span>
              </div>
            ) : filteredVisuals.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
                {visuals.length === 0
                  ? 'No visual elements were detected in the extracted PDF pages. Scanned or low-quality pages may need clearer text/image extraction.'
                  : 'No visuals found matching your criteria.'}
              </div>
            ) : (
              filteredVisuals.map((item) => {
                const visualType = item.type || item.visualType
                const conf = visualTypeConfig[visualType] || visualTypeConfig.DIAGRAM
                const Icon = conf.icon
                const isActive = activeVisual?.id === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadVisualDetail(item.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-2 ${
                      isActive
                        ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${conf.color}`}>
                        <Icon size={11} /> {conf.label}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        Page {item.pageNumber}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {item.whatItRepresents || item.caption || 'Visual explanation and structural analysis available.'}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Right Column: Active Visual Workspace & Explanation */}
        <main className="lg:col-span-8 flex flex-col gap-6">
          {detailLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <LoaderCircle className="animate-spin text-indigo-600" size={32} />
              <p className="text-sm font-medium text-slate-600">Analyzing the original PDF page…</p>
            </div>
          ) : !activeVisual ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-500">
              <ImageIcon size={48} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-800 mb-1">Select a Visual to Explore</h3>
              <p className="text-xs max-w-sm mx-auto text-slate-500">
                Choose a detected diagram, flowchart, map, graph, or table to see its original PDF page and explanation status.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Visual Viewer Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Viewer Header with Controls */}
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Visual Mode:</span>
                    <div className="inline-flex p-0.5 rounded-lg bg-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setVisualMode('split')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                          visualMode === 'split' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Side-by-Side
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisualMode('original')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                          visualMode === 'original' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Original PDF Visual
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisualMode('simplified')}
                        disabled={!activeVisual.simplifiedDiagram}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                          visualMode === 'simplified' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        AI Simplified Diagram
                      </button>
                    </div>
                  </div>

                  {/* Zoom Controls */}
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(50, z - 20))}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600"
                      title="Zoom Out"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="px-2 font-mono text-[11px] font-semibold text-slate-700">
                      {zoomLevel}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(250, z + 20))}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600"
                      title="Zoom In"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(100)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600"
                      title="Reset Zoom"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                </div>

                {/* Visual Viewport Area */}
                <div className="p-6 bg-slate-100/50 min-h-[380px] flex items-center justify-center overflow-auto">
                  {visualMode === 'original' && (
                    <div
                      className="transition-transform duration-200 flex flex-col items-center max-w-full"
                      style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                    >
                      {imageError ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                          The page image could not be rendered. <a className="underline" href={`/api/documents/${encodeURIComponent(documentId)}/file#page=${activeVisual.pageNumber}`} target="_blank" rel="noopener noreferrer">Open the original PDF to page {activeVisual.pageNumber}</a>.
                        </div>
                      ) : (
                        <div className="bg-white p-2 rounded-xl shadow-md border border-slate-200 max-w-full">
                          <img
                            src={`/api/visuals/${encodeURIComponent(documentId)}/page/${encodeURIComponent(activeVisual.pageNumber)}/image`}
                            alt={`Original visual from page ${activeVisual.pageNumber}`}
                            className="max-h-[500px] w-auto rounded-lg object-contain"
                            loading="lazy"
                            onError={() => setImageError(true)}
                          />
                        </div>
                      )}
                      <span className="mt-2 text-[11px] font-semibold text-slate-500">
                        High-Resolution Original PDF Rendering • Page {activeVisual.pageNumber}
                      </span>
                    </div>
                  )}

                  {visualMode === 'simplified' && (
                    <div className="w-full flex flex-col gap-2">
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 flex items-start gap-2">
                        <Sparkles size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                        <div>
                          <strong>✨ AI-Generated Simplified Diagram:</strong>
                          <p className="text-[11px] text-indigo-800">
                            Synthesized for conceptual clarity and quick learning. This is an AI-simplified conceptual visual, distinct from the original document diagram.
                          </p>
                        </div>
                      </div>
                      <MermaidDiagram
                        chart={activeVisual.simplifiedDiagram || (
                          parts?.length > 1
                            ? `graph TD\n  ${parts.map((p, i) => `N${i}["${(typeof p === 'string' ? p : p.name || p.label || `Component ${i+1}`).replace(/["\n]/g, '')}"]`).join('\n  ')}\n  ${parts.slice(1).map((_, i) => `N${i} --> N${i+1}`).join('\n  ')}`
                            : `graph LR\n  A["${(activeVisual.title || 'Visual Model').replace(/["\n]/g, '')}"] --> B["Structure & Purpose"]\n  B --> C["Function & Outcome"]`
                        )}
                        id={activeVisual.id}
                        documentId={documentId}
                        visualId={activeVisual.id}
                        glossary={{
                          difficultWords,
                          labelsExplanation: labels,
                          partsExplanation: parts,
                          connections,
                        }}
                      />
                    </div>
                  )}

                  {visualMode === 'split' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      {/* Left: Original */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                          <span>Original Document Page {activeVisual.pageNumber}</span>
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">PDF Extract</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl shadow-xs border border-slate-200 flex items-center justify-center min-h-[300px]">
                          {imageError ? (
                            <a className="p-4 text-xs text-amber-800 underline" href={`/api/documents/${encodeURIComponent(documentId)}/file#page=${activeVisual.pageNumber}`} target="_blank" rel="noopener noreferrer">
                              Page rendering failed. Open the original PDF page {activeVisual.pageNumber}.
                            </a>
                          ) : (
                            <img
                              src={`/api/visuals/${encodeURIComponent(documentId)}/page/${encodeURIComponent(activeVisual.pageNumber)}/image`}
                              alt={`Original visual from page ${activeVisual.pageNumber}`}
                              className="max-h-[360px] w-auto rounded-md object-contain"
                              loading="lazy"
                              onError={() => setImageError(true)}
                            />
                          )}
                        </div>
                      </div>

                      {/* Right: AI Simplified */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs font-bold text-indigo-700 px-1">
                          <span className="flex items-center gap-1"><Sparkles size={13} /> Interactive Conceptual Map</span>
                          <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-semibold">Click any word to inspect</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl shadow-xs border border-indigo-100 min-h-[300px] flex items-center justify-center">
                          <MermaidDiagram
                            chart={activeVisual.simplifiedDiagram || (
                              parts?.length > 1
                                ? `graph TD\n  ${parts.map((p, i) => `N${i}["${(typeof p === 'string' ? p : p.name || p.label || `Component ${i+1}`).replace(/["\n]/g, '')}"]`).join('\n  ')}\n  ${parts.slice(1).map((_, i) => `N${i} --> N${i+1}`).join('\n  ')}`
                                : `graph LR\n  A["${(activeVisual.title || 'Visual Model').replace(/["\n]/g, '')}"] --> B["Structure & Purpose"]\n  B --> C["Function & Outcome"]`
                            )}
                            id={activeVisual.id}
                            documentId={documentId}
                            visualId={activeVisual.id}
                            glossary={{
                              difficultWords,
                              labelsExplanation: labels,
                              partsExplanation: parts,
                              connections,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Visual Title & Meta Bar */}
                <div className="p-5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                      Visual Analysis • Page {activeVisual.pageNumber}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">{activeVisual.title}</h2>
                  </div>

                  {activeVisual.topicId && (
                    <Link
                      to={`/app/papers/${encodeURIComponent(documentId)}/learn?topicId=${encodeURIComponent(activeVisual.topicId)}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl shadow-sm transition-colors"
                    >
                      Study Associated Topic <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              </div>

              {activeVisual.status === 'FAILED' ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950" role="alert">
                  <strong>Visual explanation unavailable</strong>
                  <p className="mt-1 text-xs leading-relaxed">{activeVisual.error || 'The visual could not be analyzed.'}</p>
                  <p className="mt-2 text-xs">The original PDF page is shown above. Configure the vision model and refresh this page to retry; no labels or relationships have been guessed.</p>
                </div>
              ) : (
              <>
              {/* 11-POINT COMPREHENSIVE EXPLANATION SECTION */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-8">
                {/* 1 & 2: Overview & What it Represents */}
                <section className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Lightbulb size={16} className="text-amber-500" />
                    1. What This Visual Represents
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed bg-amber-50/50 p-4 rounded-xl border border-amber-100 font-medium">
                    {activeVisual.whatItRepresents}
                  </p>
                </section>

                {/* 3: Purpose */}
                <section className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-500" />
                    2. Purpose in Document
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {activeVisual.purpose}
                  </p>
                </section>

                {/* 4: Important Parts Breakdown */}
                {parts?.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <Layers size={16} className="text-blue-500" />
                      3. Important Parts Breakdown ({parts.length} components)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {parts.map((part, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-indigo-300 transition-all">
                          {typeof part === 'string' ? (
                            <p className="text-xs text-slate-700 leading-relaxed">{part}</p>
                          ) : (
                            <>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <h4 className="text-xs font-bold text-slate-900">{part.name || part.label || `Part ${idx + 1}`}</h4>
                                {part.role && (
                                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                    {part.role}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 leading-normal">{part.description || part.explanation}</p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 5: Labels Explained */}
                {labels?.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <TagIcon size={16} className="text-emerald-500" />
                      4. Labels & Annotations Explained ({labels.length} items)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {labels.map((lbl, idx) => (
                        <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-emerald-50/30 flex items-start gap-2.5">
                          {typeof lbl === 'string' ? (
                            <p className="text-xs text-slate-700 leading-relaxed">{lbl}</p>
                          ) : (
                            <>
                              <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded shrink-0">
                                {lbl.label || lbl.name || `Label ${idx + 1}`}
                              </span>
                              <div className="text-xs">
                                <span className="font-semibold text-slate-800">{lbl.meaning || lbl.description}</span>
                                {lbl.significance && <p className="text-slate-500 text-[11px] mt-0.5">{lbl.significance}</p>}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 6: Arrows & Flow */}
                {(arrowsList?.length > 0 || arrowsText) && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <Waypoints size={16} className="text-violet-500" />
                      5. Arrows & Direction Flow
                    </h3>
                    {arrowsText && (
                      <p className="text-xs text-slate-700 leading-relaxed bg-violet-50/40 p-3.5 rounded-xl border border-violet-100">
                        {arrowsText}
                      </p>
                    )}
                    {arrowsList?.length > 0 && (
                      <div className="space-y-2">
                        {arrowsList.map((arr, idx) => (
                          <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-violet-50/30 flex items-center justify-between gap-3 text-xs">
                            {typeof arr === 'string' ? (
                              <p className="text-xs text-slate-700">{arr}</p>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 font-semibold text-slate-800">
                                  <span className="bg-white px-2 py-0.5 rounded border border-slate-200">{arr.from || 'Start'}</span>
                                  <ArrowRight size={14} className="text-violet-600" />
                                  <span className="bg-white px-2 py-0.5 rounded border border-slate-200">{arr.to || 'End'}</span>
                                </div>
                                <span className="text-slate-600">{arr.meaning || arr.label}</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* 7: Connections Between Parts */}
                {connections?.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <Network size={16} className="text-cyan-500" />
                      6. Connections Between Parts
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {connections.map((conn, idx) => (
                        <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1">
                          {typeof conn === 'string' ? (
                            <p className="text-slate-700">{conn}</p>
                          ) : (
                            <>
                              <div className="flex items-center justify-between font-bold text-slate-800">
                                <span>{conn.between || `Connection ${idx + 1}`}</span>
                                {conn.nature && <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded">{conn.nature}</span>}
                              </div>
                              <p className="text-slate-600">{conn.description}</p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 8: Step-by-Step Process */}
                {steps?.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <ListOrdered size={16} className="text-indigo-500" />
                      7. Step-by-Step Process
                    </h3>
                    <div className="space-y-2.5">
                      {steps.map((st, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start gap-3 shadow-2xs">
                          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {st.stepNumber || idx + 1}
                          </span>
                          <div className="text-xs space-y-1 flex-1">
                            {typeof st === 'string' ? (
                              <p className="text-slate-700 leading-relaxed">{st}</p>
                            ) : (
                              <>
                                <h4 className="font-bold text-slate-900">{st.title || `Step ${idx + 1}`}</h4>
                                <p className="text-slate-600 leading-relaxed">{st.description}</p>
                                {st.details && <p className="text-slate-500 text-[11px] italic">{st.details}</p>}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 9: Easy Relatable Example */}
                {activeVisual.easyExample && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-500" />
                      8. Easy Real-World Example & Analogy
                    </h3>
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-xs space-y-2">
                      {typeof activeVisual.easyExample === 'string' ? (
                        <p className="text-amber-900 font-medium leading-relaxed">{activeVisual.easyExample}</p>
                      ) : (
                        <>
                          {activeVisual.easyExample.scenario && (
                            <div>
                              <strong className="text-amber-900">Scenario:</strong>
                              <p className="text-amber-800 mt-0.5">{activeVisual.easyExample.scenario}</p>
                            </div>
                          )}
                          {activeVisual.easyExample.analogy && (
                            <div>
                              <strong className="text-amber-900">Everyday Analogy:</strong>
                              <p className="text-amber-800 mt-0.5">{activeVisual.easyExample.analogy}</p>
                            </div>
                          )}
                          {activeVisual.easyExample.explanation && (
                            <p className="text-amber-900 font-medium pt-1 border-t border-amber-200/60">
                              {activeVisual.easyExample.explanation}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                )}

                {/* 10: Difficult Words Glossary */}
                {difficultWords?.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        <HelpCircle size={16} className="text-rose-500" />
                        9. Unfamiliar Terms & Plain-English Glossary
                      </h3>
                      <span className="text-[11px] text-slate-500">Click any term to view simple explanation</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {difficultWords.map((item, idx) => {
                        const termName = typeof item === 'string' ? item : (item.term || item.word)
                        const meaning = typeof item === 'string' ? 'Technical vocabulary' : (item.simpleMeaning || item.meaning)
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedGlossaryTerm(typeof item === 'string' ? { term: item, simpleMeaning: meaning } : item)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                              (selectedGlossaryTerm?.term || selectedGlossaryTerm?.word) === termName
                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            <span>{termName}</span>
                            <span className="text-[10px] opacity-75">({meaning})</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Selected Glossary Card */}
                    {selectedGlossaryTerm && (
                      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 text-xs space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-rose-900 text-sm">{selectedGlossaryTerm.term || selectedGlossaryTerm.word}</h4>
                          <button
                            type="button"
                            onClick={() => setSelectedGlossaryTerm(null)}
                            className="text-rose-400 hover:text-rose-600"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <p className="text-rose-800">
                          <strong>Simple Meaning:</strong> {selectedGlossaryTerm.simpleMeaning || selectedGlossaryTerm.meaning}
                        </p>
                        {(selectedGlossaryTerm.detailedExplanation || selectedGlossaryTerm.explanation) && (
                          <p className="text-rose-700">
                            <strong>Detailed Explanation:</strong> {selectedGlossaryTerm.detailedExplanation || selectedGlossaryTerm.explanation}
                          </p>
                        )}
                        {(selectedGlossaryTerm.contextExample || selectedGlossaryTerm.example) && (
                          <p className="text-rose-600 italic">
                            <strong>Example in context:</strong> "{selectedGlossaryTerm.contextExample || selectedGlossaryTerm.example}"
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {/* 11: Important Points */}
                {importantPoints?.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      10. Key Takeaways to Remember
                    </h3>
                    <ul className="space-y-2 text-xs text-slate-700">
                      {importantPoints.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-2 bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              {/* VISUAL-SPECIFIC INTERACTIVE Q&A */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <MessageSquare size={16} className="text-indigo-600" />
                    Ask Questions About This Visual
                  </h3>
                  <span className="text-[11px] text-slate-500">Ask about arrows, labels, parts, or concepts</span>
                </div>

                {/* Quick Prompts */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAskQuestion('What do the arrows represent in this diagram?')}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    What do the arrows represent?
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAskQuestion('Explain the main components in simple words.')}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Explain main components
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAskQuestion('Give me a real-life analogy for this flow.')}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Give real-life analogy
                  </button>
                </div>

                {/* Conversation History */}
                {qaHistory.length > 0 && (
                  <div className="space-y-3 pt-2 max-h-96 overflow-y-auto">
                    {qaHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl text-xs ${
                          item.role === 'user'
                            ? 'bg-indigo-50 border border-indigo-200 text-indigo-950 ml-8'
                            : 'bg-slate-50 border border-slate-200 text-slate-800 mr-8'
                        }`}
                      >
                        <span className="font-bold text-[10px] uppercase tracking-wider block mb-1 text-slate-500">
                          {item.role === 'user' ? 'You' : 'KnowFlow Visual AI'}
                        </span>
                        <p className="whitespace-pre-wrap leading-relaxed">{item.content}</p>
                        {item.citations?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap gap-1">
                            <span className="text-[10px] text-slate-400 font-semibold mr-1">Citations:</span>
                            {item.citations.map((c, cIdx) => (
                              <span key={cIdx} className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Input box */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleAskQuestion()
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder="Ask anything about this diagram, its labels, or connections..."
                    className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={asking || !questionInput.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {asking ? <LoaderCircle className="animate-spin" size={14} /> : <Send size={14} />}
                    Ask
                  </button>
                </form>
              </div>
              </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function TagIcon({ size, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  )
}
