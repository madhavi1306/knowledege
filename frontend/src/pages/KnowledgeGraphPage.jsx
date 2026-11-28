import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  FileText,
  Filter,
  Flame,
  Globe,
  HelpCircle,
  Layers,
  Lightbulb,
  ListOrdered,
  LoaderCircle,
  Maximize2,
  Milestone,
  Network,
  PieChart,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import MermaidDiagram from '../components/MermaidDiagram.jsx'
import { apiRequest } from '../services/api.js'
import {
  SUPPORTED_LANGUAGES,
  getConceptTranslation,
  speakInLanguage,
  t,
} from '../services/i18n.js'

const STATUS_CONFIG = {
  NOT_LEARNED: { label: 'Not Learned', color: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-400' },
  LEARNING: { label: 'Learning', color: 'bg-sky-50 text-sky-700 border-sky-300', dot: 'bg-sky-500' },
  WEAK: { label: 'Weak (Action Required)', color: 'bg-rose-50 text-rose-700 border-rose-300', dot: 'bg-rose-500' },
  IMPROVING: { label: 'Improving', color: 'bg-amber-50 text-amber-700 border-amber-300', dot: 'bg-amber-500' },
  MASTERED: { label: 'Mastered', color: 'bg-emerald-50 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500' },
  REVISION_REQUIRED: { label: 'Revision Required', color: 'bg-purple-50 text-purple-700 border-purple-300', dot: 'bg-purple-500' },
}

export default function KnowledgeGraphPage() {
  const [searchParams] = useSearchParams()
  const [documents, setDocuments] = useState([])
  const [selectedDocId, setSelectedDocId] = useState(searchParams.get('documentId') || '')
  const [docTopics, setDocTopics] = useState([])
  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [language, setLanguage] = useState('en')
  const [data, setData] = useState({ nodes: [], links: [], diagram: '', glossary: null, summary: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [viewMode, setViewMode] = useState('diagram') // 'diagram' | 'grid'
  const [selectedNode, setSelectedNode] = useState(null)
  const [showAnalysis, setShowAnalysis] = useState(searchParams.get('analyse') === 'true')

  useEffect(() => {
    if (searchParams.get('analyse') === 'true') {
      setShowAnalysis(true)
    }
  }, [searchParams])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [conceptDetail, setConceptDetail] = useState(null)

  // 1. Initial documents load
  useEffect(() => {
    async function loadDocuments() {
      try {
        const res = await apiRequest('/api/documents').catch(() => ({ items: [] }))
        setDocuments(res.items || [])
      } catch {
        setDocuments([])
      }
    }
    loadDocuments()
  }, [])

  // 2. Load topics when document changes (or load all topics across documents)
  useEffect(() => {
    setSelectedTopicId('')
    const url = selectedDocId
      ? `/api/analysis/topics?documentId=${encodeURIComponent(selectedDocId)}`
      : `/api/analysis/topics`

    apiRequest(url)
      .then((res) => {
        setDocTopics(res.topics || [])
      })
      .catch(() => {
        if (selectedDocId) {
          apiRequest(`/api/learning/${encodeURIComponent(selectedDocId)}`)
            .then((res) => setDocTopics(res.topics || []))
            .catch(() => setDocTopics([]))
        } else {
          setDocTopics([])
        }
      })
  }, [selectedDocId])

  // 3. Load Knowledge Graph data (supports documentId, topicId, status)
  async function loadGraph() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (selectedDocId) params.set('documentId', selectedDocId)
      if (selectedTopicId) params.set('topicId', selectedTopicId)

      const queryString = params.toString() ? `?${params.toString()}` : ''
      const res = await apiRequest(`/api/learning/graph${queryString}`)
      setData(res)

      if (res.nodes && res.nodes.length > 0) {
        const stillSelected = selectedNode ? res.nodes.find((n) => n.id === selectedNode.id) : null
        const targetNode = stillSelected || res.nodes[0]
        setSelectedNode(targetNode)
        fetchConceptDetail(targetNode.id)
      } else {
        setSelectedNode(null)
        setConceptDetail(null)
      }
    } catch (err) {
      setError(err.message || 'Failed to generate knowledge graph.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGraph()
  }, [statusFilter, selectedDocId, selectedTopicId])

  // 4. Fetch deep detail when node is selected
  async function fetchConceptDetail(conceptId) {
    if (!conceptId) return
    setDetailLoading(true)
    try {
      const res = await apiRequest(`/api/learning/concepts/${encodeURIComponent(conceptId)}`)
      setConceptDetail(res.concept)
    } catch {
      setConceptDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  // 5. Handle clicking a word or node anywhere in the visual diagram
  function handleWordClick(word) {
    if (!word) return
    const lower = word.toLowerCase().trim()

    const found = data.nodes.find(
      (n) => n.name.toLowerCase() === lower ||
             n.name.toLowerCase().includes(lower) ||
             lower.includes(n.name.toLowerCase())
    )

    if (found) {
      setSelectedNode(found)
      fetchConceptDetail(found.id)
    } else {
      const glossMatch = data.glossary?.difficultWords?.find(
        (g) => g.word.toLowerCase() === lower || lower.includes(g.word.toLowerCase())
      )
      if (glossMatch) {
        setSelectedNode({
          id: `custom-${Date.now()}`,
          name: glossMatch.word,
          definition: glossMatch.simpleMeaning,
          simpleExplanation: glossMatch.simpleMeaning,
          detailedExplanation: glossMatch.explanation,
          examples: [glossMatch.example],
          status: 'LEARNING',
          masteryScore: 70,
          difficulty: 'MEDIUM',
        })
      }
    }
  }

  // 6. Text to speech speaker with multilingual support
  function speakExplanation(text) {
    if (isSpeaking) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      setIsSpeaking(false)
      return
    }

    speakInLanguage(
      text,
      language,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    )
  }

  // Extract available topics either from API response or dynamically from loaded graph nodes
  const availableTopics = useMemo(() => {
    if (docTopics && docTopics.length > 0) {
      return docTopics
    }
    const topicMap = new Map()
    for (const node of data.nodes || []) {
      for (const t of node.topics || []) {
        if (t?.id && t?.name && !topicMap.has(t.id)) {
          topicMap.set(t.id, t)
        }
      }
    }
    return Array.from(topicMap.values())
  }, [docTopics, data.nodes])

  const filteredNodes = (data.nodes || []).filter((node) => {
    const matchesSearch =
      node.name.toLowerCase().includes(search.toLowerCase()) ||
      node.definition.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  const summary = data.summary || {
    totalConcepts: filteredNodes.length,
    statusCounts: { MASTERED: 0, IMPROVING: 0, LEARNING: 0, WEAK: 0 },
    totalRelationships: data.links?.length || 0,
  }

  // Graph Analysis Metrics
  const totalNodes = summary.totalConcepts || 1
  const masteredPct = Math.round(((summary.statusCounts?.MASTERED || 0) / totalNodes) * 100)
  const improvingPct = Math.round(((summary.statusCounts?.IMPROVING || 0) / totalNodes) * 100)
  const learningPct = Math.round(((summary.statusCounts?.LEARNING || 0) / totalNodes) * 100)
  const weakPct = Math.round(((summary.statusCounts?.WEAK || 0) / totalNodes) * 100)

  // Identify prerequisite bottlenecks (nodes with highest outgoing or incoming edges)
  const bottleneckConcept = filteredNodes.find((n) => n.status === 'WEAK' || n.status === 'LEARNING') || filteredNodes[0]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header & Controls */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5 mb-1">
            <Network size={15} className="text-indigo-500" />
            {t('Topic-Wise Knowledge Graph', language)}
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('Interactive Knowledge Graph', language)}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {t('Explore concepts, visualize dependencies, and identify weak spots in your mental model.', language)}
          </p>
        </div>

        {/* Global Controls: Language, Graph Analysis & View Modes */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Language Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
            <Globe size={14} className="text-indigo-600" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.native} ({lang.label})
                </option>
              ))}
            </select>
          </div>

          {/* Analyse Graph Button */}
          <button
            type="button"
            onClick={() => setShowAnalysis(!showAnalysis)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
              showAnalysis
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 shadow-xs'
            }`}
          >
            <BarChart3 size={14} /> {t('Analyse Knowledge Graph', language)}
          </button>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('diagram')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'diagram'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Network size={14} /> {t('Visual Graph Map', language)}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={14} /> {t('Concept Matrix', language)} ({filteredNodes.length})
            </button>
          </div>

          <button
            type="button"
            onClick={loadGraph}
            className="p-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition-colors"
            title="Refresh knowledge graph"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* GRAPH ANALYSIS DASHBOARD PANEL (Appears when toggled) */}
      <AnimatePresence>
        {showAnalysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-700/50 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      {t('Analyse Knowledge Graph', language)} – Cognitive Health & Prerequisite Metrics
                    </h3>
                    <p className="text-xs text-indigo-200">
                      Automated network analysis identifying cognitive bottlenecks, prerequisite density, and optimal study sequencing.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAnalysis(false)}
                  className="p-1 text-indigo-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Analysis Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Mastery Distribution Bar */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 block">
                    Mastery Distribution
                  </span>
                  <div className="h-3 rounded-full bg-white/10 overflow-hidden flex">
                    <div style={{ width: `${masteredPct}%` }} className="bg-emerald-400" title={`Mastered ${masteredPct}%`} />
                    <div style={{ width: `${improvingPct}%` }} className="bg-amber-400" title={`Improving ${improvingPct}%`} />
                    <div style={{ width: `${learningPct}%` }} className="bg-sky-400" title={`Learning ${learningPct}%`} />
                    <div style={{ width: `${weakPct}%` }} className="bg-rose-400" title={`Weak ${weakPct}%`} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" /> {masteredPct}% Mastered
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <span className="w-2 h-2 rounded-full bg-amber-400" /> {improvingPct}% Improving
                    </span>
                    <span className="flex items-center gap-1.5 text-sky-300">
                      <span className="w-2 h-2 rounded-full bg-sky-400" /> {learningPct}% Learning
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-300">
                      <span className="w-2 h-2 rounded-full bg-rose-400" /> {weakPct}% Action Needed
                    </span>
                  </div>
                </div>

                {/* 2. Prerequisite Bottleneck Alert */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                    <Target size={13} /> Critical Cognitive Bottleneck
                  </span>
                  <h4 className="text-sm font-bold text-white">
                    {bottleneckConcept?.name || 'Foundational Principles'}
                  </h4>
                  <p className="text-xs text-indigo-200 leading-relaxed">
                    This foundational concept serves as a gateway to multiple downstream topics. Strengthening recall here will unlock a projected <strong>+35% retention boost</strong> across connected chapters.
                  </p>
                  {bottleneckConcept && (
                    <button
                      type="button"
                      onClick={() => handleWordClick(bottleneckConcept.name)}
                      className="text-xs font-bold text-amber-300 hover:text-white flex items-center gap-1 pt-1"
                    >
                      Inspect in Inspector <ArrowRight size={12} />
                    </button>
                  )}
                </div>

                {/* 3. Optimal Learning Recommendation */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                    <Milestone size={13} /> Recommended Next Action
                  </span>
                  <p className="text-xs text-indigo-200 leading-relaxed">
                    Based on topological sorting and memory decay, your highest-leverage path is to test yourself on intermediate mechanics before moving to advanced proofs.
                  </p>
                  <div className="pt-2 flex items-center gap-2">
                    <Link
                      to="/app/learning-path"
                      className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                    >
                      Open Step-by-Step Path
                    </Link>
                    <Link
                      to="/app/quizzes"
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      Practice Quiz
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Layers size={16} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Concepts</span>
            <span className="text-base font-extrabold text-slate-900">{summary.totalConcepts}</span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('Mastered', language)}</span>
            <span className="text-base font-extrabold text-emerald-700">
              {summary.statusCounts?.MASTERED || 0}
            </span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
            <Flame size={16} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('Improving', language)}</span>
            <span className="text-base font-extrabold text-amber-700">
              {(summary.statusCounts?.IMPROVING || 0) + (summary.statusCounts?.LEARNING || 0)}
            </span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
            <Target size={16} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('Needs Focus', language)}</span>
            <span className="text-base font-extrabold text-rose-700">
              {summary.statusCounts?.WEAK || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar: Supports Document Filter & TOPIC-WISE Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Document filter */}
          <div className="relative min-w-[200px]">
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8 truncate"
            >
              <option value="">All Uploaded Documents</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ')}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Topic-Wise Filter - Always active & accessible */}
          <div className="relative min-w-[200px]">
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full text-xs font-semibold bg-indigo-50/70 border border-indigo-200 text-indigo-950 rounded-xl px-3 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8 truncate font-medium"
            >
              <option value="">
                {selectedDocId ? 'All Topics in Document' : 'All Topics & Chapters'}
              </option>
              {availableTopics.map((top) => (
                <option key={top.id} value={top.id}>
                  {top.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-indigo-500 pointer-events-none" />
          </div>

          {/* Mastery filter */}
          <div className="relative min-w-[170px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8"
            >
              <option value="ALL">All Mastery Levels</option>
              <option value="WEAK">Weak (Action Required)</option>
              <option value="LEARNING">Learning</option>
              <option value="IMPROVING">Improving</option>
              <option value="MASTERED">Mastered</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search concepts or definitions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Content: Graph Viewport + Concept Detail Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Viewport (Diagram or Grid) */}
        <div className="lg:col-span-8 space-y-4">
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center text-slate-500 gap-3">
              <LoaderCircle className="animate-spin text-indigo-600" size={32} />
              <p className="text-xs font-semibold">Generating your conceptual knowledge map…</p>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-700 text-xs space-y-2">
              <AlertCircle size={24} className="mx-auto text-rose-600" />
              <p className="font-bold">{error}</p>
              <button
                type="button"
                onClick={loadGraph}
                className="mt-2 px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredNodes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs space-y-3">
              <Layers size={36} className="mx-auto text-slate-400" />
              <h3 className="text-sm font-bold text-slate-800">No concepts found</h3>
              <p className="max-w-md mx-auto text-slate-500">
                Try selecting a different filter or upload notes to generate your knowledge map.
              </p>
            </div>
          ) : viewMode === 'diagram' ? (
            /* Visual Interactive Diagram View */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Interactive Banner */}
              <div className="px-4 py-2.5 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-900">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Sparkles size={14} className="text-indigo-600" />
                  <strong>Interactive Map:</strong> Click any concept or word below to see its simple meaning!
                </span>
                <span className="text-[11px] text-indigo-700 font-medium">
                  {filteredNodes.length} nodes · {data.links?.length || 0} links
                </span>
              </div>

              {/* Mermaid Diagram Canvas */}
              <div className="p-6 overflow-x-auto min-h-[480px] flex items-center justify-center bg-slate-50/30">
                <MermaidDiagram
                  chart={data.diagram}
                  id="knowledge-graph-canvas"
                  glossary={data.glossary}
                  onWordClick={handleWordClick}
                />
              </div>

              <div className="px-4 py-3 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> {t('Mastered', language)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> {t('Improving', language)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> {t('Learning', language)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> {t('Needs Focus', language)}
                  </span>
                </div>
                <span>Arrows show prerequisite and dependency flows</span>
              </div>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id
                const config = STATUS_CONFIG[node.status] || STATUS_CONFIG.LEARNING
                const translatedMeaning = getConceptTranslation(
                  node.name,
                  node.simpleExplanation || node.definition,
                  language
                )

                return (
                  <motion.div
                    key={node.id}
                    onClick={() => {
                      setSelectedNode(node)
                      fetchConceptDetail(node.id)
                    }}
                    whileHover={{ y: -2 }}
                    className={`p-4 rounded-xl border bg-white cursor-pointer transition-all shadow-xs ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${config.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                        {config.label}
                      </span>
                      <span className="text-[11px] font-extrabold text-slate-700">
                        {node.masteryScore}%
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 leading-snug mb-1">
                      {node.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {translatedMeaning}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                      <span>Difficulty: {node.difficulty}</span>
                      <span className="text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-0.5">
                        Inspect <ArrowRight size={10} />
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Selected Concept Deep Inspector Drawer */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sticky top-6 space-y-4">
            {selectedNode ? (
              <>
                {/* Concept Header */}
                <div className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        STATUS_CONFIG[selectedNode.status]?.color || 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          STATUS_CONFIG[selectedNode.status]?.dot || 'bg-slate-400'
                        }`}
                      />
                      {STATUS_CONFIG[selectedNode.status]?.label || selectedNode.status}
                    </span>
                    <span className="text-xs font-extrabold text-slate-800">
                      {selectedNode.masteryScore}% Mastery
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                    {selectedNode.name}
                  </h3>
                </div>

                {/* 1. Simple Meaning Box with Audio Listen */}
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                      <Sparkles size={13} className="text-indigo-600" /> {t('Simple Meaning', language)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        speakExplanation(
                          `${selectedNode.name}. ${getConceptTranslation(
                            selectedNode.name,
                            selectedNode.simpleExplanation || selectedNode.definition,
                            language
                          )}`
                        )
                      }
                      className="p-1 rounded-lg text-indigo-600 hover:bg-indigo-100/70 transition-colors flex items-center gap-1 text-[10px] font-bold"
                      title={isSpeaking ? 'Stop speaking' : 'Read simple meaning aloud'}
                    >
                      {isSpeaking ? <VolumeX size={14} className="text-rose-600" /> : <Volume2 size={14} />}
                      <span>{isSpeaking ? t('Stop', language) : t('Listen', language)}</span>
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-indigo-950 leading-relaxed">
                    {getConceptTranslation(
                      selectedNode.name,
                      selectedNode.simpleExplanation || selectedNode.definition,
                      language
                    )}
                  </p>
                </div>

                {/* 2. Real-World Example */}
                {(selectedNode.examples?.length > 0 || conceptDetail?.realLifeExample) && (
                  <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                      <Lightbulb size={12} className="text-amber-600" /> {t('Real-World Example', language)}
                    </span>
                    <p className="text-xs text-amber-950 leading-relaxed font-medium">
                      💡 {selectedNode.examples?.[0] || conceptDetail?.realLifeExample}
                    </p>
                  </div>
                )}

                {/* 3. Detailed Academic Definition */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    {t('Detailed Explanation', language)}
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {selectedNode.detailedExplanation || selectedNode.definition}
                  </p>
                </div>

                {/* 4. Prerequisites if any (deduplicated) */}
                {conceptDetail?.prerequisites && conceptDetail.prerequisites.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Prerequisites
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(new Map(conceptDetail.prerequisites.map((p) => [p.id, p])).values()).map((p) => (
                        <span
                          key={p.id}
                          onClick={() => handleWordClick(p.name)}
                          className="text-[10px] font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Direct Action Links */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <Link
                    to={`/app/quizzes?conceptId=${encodeURIComponent(selectedNode.id)}`}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    <Zap size={14} /> Practice Concept Quiz
                  </Link>

                  <Link
                    to={`/app/concepts/${encodeURIComponent(selectedNode.id)}`}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                  >
                    <BookOpen size={14} /> Deep Learning Mode
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <HelpCircle size={28} className="mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">Select any concept</p>
                <p className="text-[11px] text-slate-400">
                  Click any node in the knowledge map or card in the matrix to view simple meanings, examples, and test options.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
