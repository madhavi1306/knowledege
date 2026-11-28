import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock,
  Compass,
  Eye,
  FileText,
  Globe,
  HelpCircle,
  Layers,
  Lightbulb,
  ListOrdered,
  LoaderCircle,
  Maximize2,
  Minimize2,
  MessageSquare,
  Milestone,
  Network,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Volume2,
  X,
  ExternalLink,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import DocumentChatDrawer from '../components/DocumentChatDrawer.jsx'
import MermaidDiagram from '../components/MermaidDiagram.jsx'
import { apiRequest } from '../services/api.js'
import {
  SUPPORTED_LANGUAGES,
  getConceptTranslation,
  speakInLanguage,
  t,
} from '../services/i18n.js'

function getTopicDiagram(material) {
  if (material?.diagram && material.diagram.trim().startsWith('graph')) {
    return material.diagram
  }

  const title = (material?.topicTitle || 'Core Topic').replace(/["\[\]\(\)\{\}\<\>]/g, ' ')
  const chapter = (material?.chapterTitle || 'Chapter').replace(/["\[\]\(\)\{\}\<\>]/g, ' ')
  const points = (material?.importantPoints || []).slice(0, 3).map((p) => p.replace(/["\[\]\(\)\{\}\<\>]/g, ' ').slice(0, 42))
  const steps = (material?.stepByStepExplanation || []).slice(0, 3).map((s) => s.replace(/["\[\]\(\)\{\}\<\>]/g, ' ').slice(0, 42))
  const related = (material?.relatedConcepts || []).slice(0, 2).map((r) => r.replace(/["\[\]\(\)\{\}\<\>]/g, ' ').slice(0, 38))

  let chart = 'graph TD\n'
  chart += `  Chapter["📘 ${chapter}"] --> Topic["🎯 ${title}"]\n`

  if (steps.length >= 2) {
    chart += `  Topic --> S1["1. ${steps[0]}"]\n`
    chart += `  S1 --> S2["2. ${steps[1]}"]\n`
    if (steps[2]) {
      chart += `  S2 --> S3["3. ${steps[2]}"]\n`
      chart += `  S3 --> Result["✅ Mastery & Applied Retention"]\n`
    } else {
      chart += `  S2 --> Result["✅ Mastery & Applied Retention"]\n`
    }
  } else if (points.length >= 2) {
    chart += `  Topic --> P1["💡 ${points[0]}"]\n`
    chart += `  Topic --> P2["🔑 ${points[1]}"]\n`
    chart += `  P1 --> Result["✅ Practical Outcome"]\n`
    chart += `  P2 --> Result\n`
  } else {
    chart += `  Topic --> Def["Core Rules & Definitions"]\n`
    chart += `  Def --> Process["Analytical Process"]\n`
    chart += `  Process --> Result["Applied Problem Solving"]\n`
  }

  if (related.length > 0) {
    related.forEach((rel, idx) => {
      chart += `  Result -.->|connects to| Rel${idx}["🔗 ${rel}"]\n`
    })
  }

  chart += '\n  %% Styling\n'
  chart += '  style Chapter fill:#f8fafc,stroke:#94a3b8,stroke-width:1.5px,color:#334155\n'
  chart += '  style Topic fill:#eff6ff,stroke:#3b82f6,stroke-width:2.5px,color:#1e40af\n'
  chart += '  style Result fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#065f46\n'

  return chart
}

function getTopicGlossary(material) {
  if (!material) return null
  const difficultWords = [...(material.difficultWords || [])]

  if (!difficultWords.some((w) => w.word.toLowerCase() === (material.topicTitle || '').toLowerCase())) {
    difficultWords.push({
      word: material.topicTitle,
      simpleMeaning: material.simpleDefinition,
      explanation: material.easyExplanation,
      example: material.realWorldExample || 'Core subject topic examined in this module.',
    })
  }

  if (material.chapterTitle && !difficultWords.some((w) => w.word.toLowerCase() === material.chapterTitle.toLowerCase())) {
    difficultWords.push({
      word: material.chapterTitle,
      simpleMeaning: `Chapter module organizing ${material.topicTitle} and related concepts.`,
      explanation: 'Provides foundational structural context.',
      example: 'Refer to chapter syllabus for learning objectives.',
    })
  }

  (material.relatedConcepts || []).forEach((rc) => {
    if (!difficultWords.some((w) => w.word.toLowerCase() === rc.toLowerCase())) {
      difficultWords.push({
        word: rc,
        simpleMeaning: `A concept related to ${material.topicTitle}.`,
        explanation: `Shares conceptual or mathematical principles with ${material.topicTitle}.`,
        example: `Studied concurrently with ${material.topicTitle}.`,
      })
    }
  })

  return {
    difficultWords,
    labelsExplanation: difficultWords.map((w) => ({
      label: w.word,
      meaning: w.simpleMeaning,
    })),
  }
}

export default function DocumentLearningWorkspacePage() {
  const { documentId, topicId: routeTopicId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const [availableDocuments, setAvailableDocuments] = useState([])
  const [viewMode, setViewMode] = useState('focused') // 'focused' | 'diagram' | 'steps' | 'all'
  const [workspace, setWorkspace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTopicId, setActiveTopicId] = useState(routeTopicId || null)
  const [activeMaterial, setActiveMaterial] = useState(null)
  const [materialLoading, setMaterialLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [language, setLanguage] = useState('en')
  const [isExtraPageOpen, setIsExtraPageOpen] = useState(Boolean(routeTopicId))

  // Close extra page on Escape
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && isExtraPageOpen) {
        handleCloseExtraPage()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isExtraPageOpen, documentId])

  // Load available documents for multi-document switching
  useEffect(() => {
    async function fetchDocs() {
      try {
        const res = await apiRequest('/api/documents')
        setAvailableDocuments(res.items || res.documents || [])
      } catch {}
    }
    fetchDocs()
  }, [])

  // 1. Load document workspace
  async function loadWorkspace(keepActiveTopic = true) {
    try {
      setLoading(true)
      const data = await apiRequest(`/api/learning/${encodeURIComponent(documentId)}`)
      setWorkspace(data)
      setError('')

      // If route has specific topicId, load that
      if (routeTopicId) {
        setActiveTopicId(routeTopicId)
        loadTopicMaterial(routeTopicId)
        setIsExtraPageOpen(true)
        return
      }

      // Auto-select first real topic if none active (prefer first subtopic under chapter)
      if (!keepActiveTopic || !activeTopicId) {
        const firstTopic = data.chapters?.[0]?.subtopics?.[0] || data.topics?.[0]
        if (firstTopic) {
          setActiveTopicId(firstTopic.id)
          loadTopicMaterial(firstTopic.id)
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load document learning workspace.')
    } finally {
      setLoading(false)
    }
  }

  function handleSelectTopic(topicId, openExtraPage = true) {
    if (!topicId) return
    setActiveTopicId(topicId)
    loadTopicMaterial(topicId)
    if (openExtraPage) {
      setIsExtraPageOpen(true)
      window.history.pushState(null, '', `/app/papers/${documentId}/topics/${topicId}`)
      const el = document.getElementById('extra-page-scroll-container')
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function handleCloseExtraPage() {
    setIsExtraPageOpen(false)
    window.history.pushState(null, '', `/app/papers/${documentId}/learn`)
  }

  function handleNavigateExtraTopic(targetTopicId) {
    if (!targetTopicId) return
    setActiveTopicId(targetTopicId)
    loadTopicMaterial(targetTopicId)
    window.history.pushState(null, '', `/app/papers/${documentId}/topics/${targetTopicId}`)
    const el = document.getElementById('extra-page-scroll-container')
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 2. Load or generate material for a topic
  async function loadTopicMaterial(topicId, forceRegenerate = false) {
    if (!topicId) return
    setActiveTopicId(topicId)
    setMaterialLoading(true)
    try {
      const url = `/api/learning/${encodeURIComponent(documentId)}/topics/${encodeURIComponent(topicId)}${forceRegenerate ? '?regenerate=true' : ''}`
      const res = await apiRequest(url)
      setActiveMaterial(res.material)
    } catch (err) {
      setError(err.message || 'Failed to generate learning material.')
    } finally {
      setMaterialLoading(false)
      setRegenerating(false)
    }
  }

  // 3. Update completion status
  async function handleStatusChange(topicId, nextStatus) {
    try {
      const res = await apiRequest(`/api/learning/${encodeURIComponent(documentId)}/topics/${encodeURIComponent(topicId)}/status`, {
        method: 'PATCH',
        body: { status: nextStatus },
      })
      setActiveMaterial(res.material)
      // Refresh workspace progress stats
      loadWorkspace(true)
    } catch (err) {
      setError(err.message)
    }
  }

  // 4. Batch generate all topics
  async function handleBatchGenerate() {
    try {
      setBatchGenerating(true)
      await apiRequest(`/api/learning/${encodeURIComponent(documentId)}/generate-all`, { method: 'POST' })
      loadWorkspace(true)
      if (activeTopicId) loadTopicMaterial(activeTopicId)
    } catch (err) {
      setError(err.message)
    } finally {
      setBatchGenerating(false)
    }
  }

  useEffect(() => {
    loadWorkspace(false)
  }, [documentId])

  const topics = workspace?.topics || []
  const filteredTopics = topics.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const activeTopic = topics.find((t) => t.id === activeTopicId) || topics[0]

  // Prev / Next topic index calculation
  const currentIndex = topics.findIndex((t) => t.id === activeTopicId)
  const prevTopic = currentIndex > 0 ? topics[currentIndex - 1] : null
  const nextTopic = currentIndex >= 0 && currentIndex < topics.length - 1 ? topics[currentIndex + 1] : null

  if (loading && !workspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[480px] gap-3">
        <LoaderCircle className="animate-spin text-brand-600" size={32} />
        <p className="text-sm text-text-muted">Loading learning workspace…</p>
      </div>
    )
  }

  if (error && !workspace) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertCircle className="text-rose-500 mx-auto" size={40} />
        <h2 className="text-xl font-bold text-text-main">Workspace Error</h2>
        <p className="text-sm text-text-muted">{error}</p>
        <Link to="/app/papers" className="inline-flex items-center gap-2 text-sm text-brand-600 font-medium">
          <ArrowLeft size={16} /> Back to My Papers
        </Link>
      </div>
    )
  }

  return (
    <div className="learning-workspace-container space-y-6 pb-16">
      {/* Top Header / Breadcrumb Bar */}
      <header className="bg-surface rounded-2xl border border-border p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-1">
            <Link to="/app/papers" className="hover:underline flex items-center gap-1">
              <ArrowLeft size={14} /> My Papers
            </Link>
            <span>/</span>
            <span>LEARNING WORKSPACE</span>
          </div>
          <h1 className="text-2xl font-black text-text-main flex items-center gap-2">
            {workspace?.document?.fileName || 'Document Learning'}
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Structured step-by-step notes grounded in the actual document, written in student-friendly English.
          </p>
        </div>

        {/* Progress Card & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-surface-muted border border-border/80 px-4 py-2.5 rounded-xl flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Completed</span>
              <span className="text-sm font-extrabold text-brand-600">
                {workspace?.overview?.completedTopics || 0} / {workspace?.overview?.totalTopics || 0} Topics
              </span>
            </div>
            <div className="w-12 h-12 relative flex items-center justify-center">
              <span className="text-xs font-bold text-text-main">{workspace?.overview?.progressPercent || 0}%</span>
            </div>
          </div>

          <Link
            to={`/app/papers/${encodeURIComponent(documentId)}/test?topicId=${encodeURIComponent(activeTopicId || '')}`}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200 transition-colors flex items-center gap-1.5"
            title="Take an assessment test on this topic"
          >
            <ClipboardCheck size={15} /> Topic Test
          </Link>
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            title="Ask AI questions about this document or topic"
          >
            <MessageSquare size={15} /> Ask AI Tutor
          </button>

          <button
            type="button"
            onClick={handleBatchGenerate}
            disabled={batchGenerating}
            className="px-3.5 py-2.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded-xl border border-brand-200 transition-colors flex items-center gap-2"
          >
            {batchGenerating ? <LoaderCircle className="animate-spin" size={15} /> : <Sparkles size={15} />}
            {batchGenerating ? 'Generating All…' : 'Generate All Notes'}
          </button>

          {/* Language Selector */}
          <div className="flex items-center gap-1.5 bg-surface border border-border px-3 py-2 rounded-xl">
            <Globe size={14} className="text-brand-600" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-xs font-bold text-text-main bg-transparent focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.native} ({lang.label})
                </option>
              ))}
            </select>
          </div>

          <Link
            to={`/app/learning-path?documentId=${encodeURIComponent(documentId)}`}
            className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors flex items-center gap-1.5"
            title="Step-by-Step Basic to Advanced Learning Path"
          >
            <Milestone size={15} /> Basic to Advanced Path
          </Link>
          <Link
            to={`/app/graph?documentId=${encodeURIComponent(documentId)}`}
            className="px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold rounded-xl border border-sky-200 transition-colors flex items-center gap-1.5"
            title="Interactive Knowledge Graph"
          >
            <Network size={15} /> Topic Graph Map
          </Link>
          <Link
            to={`/app/papers/${encodeURIComponent(documentId)}/test`}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200 transition-colors flex items-center gap-1.5"
          >
            <ClipboardCheck size={15} /> Take Assessment
          </Link>
          <Link
            to={`/app/papers/${encodeURIComponent(documentId)}/adaptive`}
            className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={15} /> Weak Topics & Retest
          </Link>
          <a
            href={`/api/documents/${encodeURIComponent(documentId)}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2.5 bg-surface border border-border hover:bg-surface-muted text-text-main text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
          >
            <FileText size={15} /> Open PDF <ArrowUpRight size={13} />
          </a>
        </div>
      </header>

      {/* Multi-Document Switcher Bar (Switch between selected URL / Notes / Papers) */}
      {availableDocuments.length > 1 && (
        <nav aria-label="Available documents" className="bg-surface rounded-2xl border border-border p-3.5 shadow-sm flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold text-text-muted flex items-center gap-1.5 shrink-0">
            <Layers size={14} className="text-brand-600" /> Switch Document:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {availableDocuments.map((doc) => {
              const isCurrent = doc.id === documentId
              return (
                <Link
                  key={doc.id}
                  to={`/app/papers/${encodeURIComponent(doc.id)}/learn${location.search}`}
                  style={isCurrent ? { backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' } : {}}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isCurrent
                      ? 'shadow-xs ring-2 ring-blue-400/50'
                      : 'bg-surface-muted hover:bg-surface text-text-main border border-border'
                  }`}
                >
                  <FileText size={13} />
                  <span className="max-w-[240px] truncate">{doc.fileName}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      )}

      {/* Main Workspace Layout (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chapters & Topic Navigation */}
        <aside className="lg:col-span-4 bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-4 sticky top-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Compass size={14} /> Document Chapters
            </h3>
            <span className="text-xs text-text-muted font-medium">{topics.length} topics</span>
          </div>

          {/* Search filter */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-text-muted" size={15} />
            <input
              type="text"
              placeholder="Search topics in order…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-muted border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text-main focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Ordered Topics / Chapters List (Grouped by Chapter cleanly) */}
          <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
            {workspace?.chapters?.length > 0 ? (
              workspace.chapters.map((ch, chIdx) => {
                const subtopics = (ch.subtopics && ch.subtopics.length > 0)
                  ? ch.subtopics
                  : [ch]
                const visibleSubtopics = subtopics.filter((st) =>
                  st.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                if (visibleSubtopics.length === 0) return null

                return (
                  <div key={ch.id || chIdx} className="space-y-1.5">
                    <div className="px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-brand-700 bg-brand-50/70 border border-brand-200/70 rounded-xl flex items-center gap-1.5 shadow-2xs">
                      <Layers size={13} className="text-brand-600 shrink-0" />
                      <span className="truncate">{ch.title}</span>
                    </div>

                    <div className="space-y-1 pl-1">
                      {visibleSubtopics.map((topic) => {
                        const isActive = topic.id === activeTopicId
                        const isDone = topic.status === 'COMPLETED'
                        const isProgress = topic.status === 'IN_PROGRESS'

                        return (
                          <button
                            key={topic.id}
                            type="button"
                            onClick={() => handleSelectTopic(topic.id, true)}
                            className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2.5 ${
                              isActive
                                ? 'bg-brand-50 border-brand-300 text-brand-900 shadow-xs font-semibold ring-1 ring-brand-300'
                                : 'border-transparent hover:bg-surface-muted text-text-main'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span className="mt-0.5 shrink-0">
                                {isDone ? (
                                  <CheckCircle2 size={15} className="text-emerald-600" />
                                ) : isProgress ? (
                                  <Clock size={15} className="text-amber-500" />
                                ) : (
                                  <Circle size={15} className="text-text-muted/60" />
                                )}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-bold block truncate leading-snug">{topic.name}</span>
                                {topic.description && (
                                  <p className="text-[10px] text-text-muted line-clamp-1 mt-0.5 font-normal leading-normal">
                                    {topic.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-0.5 mt-0.5 shadow-2xs">
                              Open <ArrowUpRight size={10} />
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            ) : filteredTopics.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-6">No matching topics found.</p>
            ) : (
              filteredTopics.map((topic, idx) => {
                const isActive = topic.id === activeTopicId
                const isDone = topic.status === 'COMPLETED'
                const isProgress = topic.status === 'IN_PROGRESS'

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleSelectTopic(topic.id, true)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                      isActive
                        ? 'bg-brand-50 border-brand-300 text-brand-900 shadow-sm font-semibold'
                        : 'border-transparent hover:bg-surface-muted text-text-main'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="mt-0.5">
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        ) : isProgress ? (
                          <Clock size={16} className="text-amber-500" />
                        ) : (
                          <Circle size={16} className="text-text-muted/60" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold truncate leading-snug">{topic.name}</span>
                          <span className="text-[10px] text-text-muted font-mono opacity-70">#{idx + 1}</span>
                        </div>
                        {topic.description && (
                          <p className="text-[11px] text-text-muted line-clamp-1 mt-0.5 font-normal leading-normal">
                            {topic.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-0.5 mt-0.5 shadow-2xs">
                      Open <ArrowUpRight size={10} />
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Right Column: Complete Structured Topic Learning Workspace */}
        <main className="lg:col-span-8 space-y-6">
          {materialLoading ? (
            <div className="bg-surface rounded-2xl border border-border p-12 text-center space-y-3">
              <LoaderCircle className="animate-spin text-brand-600 mx-auto" size={32} />
              <h4 className="text-base font-bold text-text-main">Synthesizing Learning Material…</h4>
              <p className="text-xs text-text-muted">
                Extracting definitions, step-by-step guides, real-world examples, and vocabulary directly from your PDF.
              </p>
            </div>
          ) : !activeMaterial ? (
            <div className="bg-surface rounded-2xl border border-border p-12 text-center space-y-3">
              <BookOpen className="text-text-muted mx-auto" size={36} />
              <h4 className="text-base font-bold text-text-main">No Topic Selected</h4>
              <p className="text-xs text-text-muted">Select a topic from the left sidebar to view structured notes.</p>
            </div>
          ) : (
            <motion.div
              key={activeMaterial.topicId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Topic Hero Card */}
              <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider block">
                      {activeMaterial.chapterTitle || 'Core Document Topic'}
                    </span>
                    <h2 className="text-2xl font-black text-text-main">{activeMaterial.topicTitle}</h2>
                  </div>

                  {/* Actions: Open Extra Page, Mark Status & Regenerate */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsExtraPageOpen(true)}
                      style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-colors hover:opacity-95"
                      title="Open this topic in a spacious dedicated full page"
                    >
                      <Maximize2 size={13} />
                      <span>Open Extra Page</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusChange(
                        activeMaterial.topicId,
                        activeMaterial.status === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED'
                      )}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                        activeMaterial.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-surface-muted hover:bg-surface border border-border text-text-main'
                      }`}
                    >
                      <CheckCircle2 size={14} />
                      {activeMaterial.status === 'COMPLETED' ? 'Completed' : 'Mark as Done'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRegenerating(true)
                        loadTopicMaterial(activeMaterial.topicId, true)
                      }}
                      disabled={regenerating}
                      title="Regenerate explanation with AI"
                      className="p-2 text-text-muted hover:text-brand-600 rounded-lg hover:bg-surface-muted border border-border transition-colors"
                    >
                      <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                {/* 1. Simple Definition */}
                <div className="bg-brand-50/70 border border-brand-200 p-4 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-brand-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Lightbulb size={14} /> {t('Simple Meaning', language)}
                    </span>
                    <button
                      type="button"
                      onClick={() => speakInLanguage(
                        `${activeMaterial.topicTitle}. ${getConceptTranslation(activeMaterial.topicTitle, activeMaterial.simpleDefinition, language)}`,
                        language
                      )}
                      className="text-xs font-bold text-brand-700 hover:text-brand-900 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-brand-100/60 transition-colors"
                      title="Read aloud in selected language"
                    >
                      <Volume2 size={13} /> {t('Listen', language)}
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-brand-950 leading-relaxed">
                    {getConceptTranslation(activeMaterial.topicTitle, activeMaterial.simpleDefinition, language)}
                  </p>
                </div>
              </div>

              {/* View Mode Filter: Only show what I select */}
              <div className="bg-surface rounded-2xl border border-border p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-text-muted px-1.5 flex items-center gap-1">
                    <Eye size={13} /> View:
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewMode('focused')}
                    style={viewMode === 'focused' ? { backgroundColor: '#2563eb', color: '#ffffff' } : {}}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                      viewMode === 'focused'
                        ? 'shadow-sm ring-1 ring-blue-700'
                        : 'bg-surface text-slate-700 hover:text-blue-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <Sparkles size={13} /> 🎯 Focused Topic Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('diagram')}
                    style={viewMode === 'diagram' ? { backgroundColor: '#2563eb', color: '#ffffff' } : {}}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                      viewMode === 'diagram'
                        ? 'shadow-sm ring-1 ring-blue-700'
                        : 'bg-surface text-slate-700 hover:text-blue-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <Network size={13} /> 📊 Concept Diagram
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('steps')}
                    style={viewMode === 'steps' ? { backgroundColor: '#2563eb', color: '#ffffff' } : {}}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                      viewMode === 'steps'
                        ? 'shadow-sm ring-1 ring-blue-700'
                        : 'bg-surface text-slate-700 hover:text-blue-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <ListOrdered size={13} /> 📋 Step-by-Step
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('all')}
                    style={viewMode === 'all' ? { backgroundColor: '#2563eb', color: '#ffffff' } : {}}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                      viewMode === 'all'
                        ? 'shadow-sm ring-1 ring-blue-700'
                        : 'bg-surface text-slate-700 hover:text-blue-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <BookOpen size={13} /> 📖 Complete All Notes
                  </button>
                </div>
              </div>

              {/* 2. Easy Explanation (Plain English for Students) */}
              {(viewMode === 'focused' || viewMode === 'all') && (
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-3">
                  <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="text-brand-600" size={16} /> Easy Explanation (In Plain English)
                  </h3>
                  <p className="text-sm text-text-main leading-relaxed whitespace-pre-line">
                    {activeMaterial.easyExplanation}
                  </p>
                </div>
              )}

              {/* Middle-of-Topic Concept Diagram & Visual Flowchart */}
              {(viewMode === 'diagram' || viewMode === 'focused' || viewMode === 'all') && (
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 flex items-center gap-1">
                        <Network size={14} className="text-brand-600" /> Interactive Concept Diagram
                      </span>
                      <h3 className="text-sm font-extrabold text-text-main">
                        {activeMaterial.topicTitle} – Visual Mind Map & Mechanism
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                      💡 Click any box or word in diagram to see simple meaning & audio
                    </span>
                  </div>

                  <div className="p-4 bg-surface-muted/40 rounded-xl border border-border/80 flex items-center justify-center overflow-x-auto min-h-[220px]">
                    <MermaidDiagram
                      chart={getTopicDiagram(activeMaterial)}
                      glossary={getTopicGlossary(activeMaterial)}
                      id={`topic-diagram-${activeMaterial.topicId || 'active'}`}
                    />
                  </div>
                </div>
              )}

              {/* 3. Detailed Academic Explanation */}
              {viewMode === 'all' && (
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-3">
                  <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="text-violet-600" size={16} /> Detailed Explanation & Context
                  </h3>
                  <p className="text-sm text-text-main leading-relaxed whitespace-pre-line font-normal">
                    {activeMaterial.detailedExplanation}
                  </p>
                </div>
              )}

              {/* 4. Step-by-Step Explanation */}
              {(viewMode === 'steps' || viewMode === 'all') && activeMaterial.stepByStepExplanation?.length > 0 && (
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
                  <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-wider flex items-center gap-2">
                    <ListOrdered className="text-amber-500" size={16} /> Step-by-Step Breakdown
                  </h3>
                  <div className="space-y-2.5">
                    {activeMaterial.stepByStepExplanation.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-surface-muted border border-border/70">
                        <span className="w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-xs text-text-main leading-relaxed font-medium">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Real-World Example */}
              {(viewMode === 'steps' || viewMode === 'all') && activeMaterial.realWorldExample && (
                <div className="bg-gradient-to-r from-amber-500/10 to-transparent border-l-4 border-amber-500 bg-surface rounded-2xl border-y border-r border-border p-6 shadow-sm space-y-2">
                  <h3 className="text-xs font-extrabold text-amber-700 uppercase tracking-wider flex items-center gap-2">
                    <Zap size={16} /> Real-World Example & Analogy
                  </h3>
                  <p className="text-sm text-text-main leading-relaxed italic">
                    "{activeMaterial.realWorldExample}"
                  </p>
                </div>
              )}

              {/* 6. Important Points */}
              {(viewMode === 'focused' || viewMode === 'all') && activeMaterial.importantPoints?.length > 0 && (
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-3">
                  <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-600" size={16} /> Key Takeaways
                  </h3>
                  <ul className="space-y-2">
                    {activeMaterial.importantPoints.map((pt, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-text-main">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 7. Difficult Words Glossary (Word, Meaning, Explanation, Example) */}
              {viewMode === 'all' && activeMaterial.difficultWords?.length > 0 && (
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
                  <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-wider flex items-center gap-2">
                    <HelpCircle className="text-rose-500" size={16} /> Vocabulary & Difficult Terms
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {activeMaterial.difficultWords.map((item, idx) => (
                      <div key={idx} className="border border-border rounded-xl p-3.5 bg-surface-muted/40 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-brand-700 font-mono">{item.word}</span>
                          <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded font-medium">Term</span>
                        </div>
                        <p className="text-xs font-semibold text-text-main">{item.simpleMeaning}</p>
                        {item.explanation && (
                          <p className="text-[11px] text-text-muted">{item.explanation}</p>
                        )}
                        {item.example && (
                          <p className="text-[11px] text-amber-700 italic bg-amber-50/60 p-1.5 rounded border border-amber-200/60">
                            Example: {item.example}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 8 & 9. Related Concepts & Page References */}
              {viewMode === 'all' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Related concepts */}
                  <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-2.5">
                    <span className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                      <Layers size={14} /> Related Concepts
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(activeMaterial.relatedConcepts || []).map((rc, idx) => (
                        <span key={idx} className="text-xs font-medium bg-brand-50 text-brand-800 px-2.5 py-1 rounded-lg border border-brand-200">
                          {rc}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Page references in PDF */}
                  <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-2.5">
                    <span className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={14} /> Document Page References
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {(activeMaterial.pageReferences || []).map((page) => (
                        <a
                          key={page}
                          href={`/api/documents/${encodeURIComponent(documentId)}/file#page=${page}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-brand-600 bg-surface-muted hover:bg-brand-50 border border-border px-3 py-1 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          Page {page} <ArrowUpRight size={12} />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 10 & 11. Quick Revision Notes & Key Things to Remember */}
              {viewMode === 'all' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Quick Revision Notes */}
                  <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-2.5">
                    <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap size={14} /> Quick Revision Notes
                    </span>
                    <ul className="space-y-1.5 text-xs text-text-main">
                      {(activeMaterial.quickRevisionNotes || []).map((note, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Key Things to Remember */}
                  <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-2.5">
                    <span className="text-[11px] font-extrabold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle size={14} /> Key Things to Remember
                    </span>
                    <ul className="space-y-1.5 text-xs text-text-main">
                      {(activeMaterial.keyThingsToRemember || []).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-rose-500 font-bold">!</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Prev / Next Topic Navigation Footer */}
              <nav className="flex items-center justify-between border-t border-border pt-6" aria-label="Topic navigation">
                {prevTopic ? (
                  <button
                    type="button"
                    onClick={() => loadTopicMaterial(prevTopic.id)}
                    className="flex items-center gap-2 text-xs font-bold text-text-main hover:text-brand-600 bg-surface border border-border px-4 py-2.5 rounded-xl transition-colors"
                  >
                    <ArrowLeft size={15} /> Previous: {prevTopic.name}
                  </button>
                ) : (
                  <div />
                )}

                {nextTopic && (
                  <button
                    type="button"
                    onClick={() => loadTopicMaterial(nextTopic.id)}
                    className="flex items-center gap-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2.5 rounded-xl transition-colors shadow-sm ml-auto"
                  >
                    Next: {nextTopic.name} <ArrowRight size={15} />
                  </button>
                )}
              </nav>
            </motion.div>
          )}
        </main>
      </div>

      {/* Integrated AI Chat Drawer (allows asking without losing current topic) */}
      <DocumentChatDrawer
        documentId={documentId}
        documentTitle={workspace?.document?.fileName}
        activeTopic={activeTopic}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      {/* ------------------------------------------------------------- */}
      {/* DEDICATED TOPIC EXTRA PAGE (Distraction-free, Spacious Reader) */}
      {/* ------------------------------------------------------------- */}
      {isExtraPageOpen && (
        <div
          id="extra-page-scroll-container"
          className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto"
          tabIndex={-1}
        >
          {/* Sticky Header Bar */}
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-xs">
            <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
              {/* Left: Back to Topics button */}
              <button
                type="button"
                onClick={handleCloseExtraPage}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 transition-all shadow-2xs"
                title="Return to syllabus (or press Esc)"
              >
                <ArrowLeft size={16} />
                <span>Back to Document Topics</span>
                <kbd className="hidden sm:inline-block text-[10px] bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-500 font-mono">Esc</kbd>
              </button>

              {/* Center: Context & Breadcrumb */}
              <div className="hidden md:flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="text-slate-900 font-extrabold truncate max-w-[200px]">{workspace?.document?.fileName}</span>
                <span className="text-slate-400">/</span>
                <span className="text-blue-700 font-bold truncate max-w-[240px]">{activeMaterial?.chapterTitle || 'Chapter'}</span>
              </div>

              {/* Right: Actions (Language, Audio, Status, Open New Tab, Close) */}
              <div className="flex items-center gap-2">
                {/* Language Selector */}
                <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                  <Globe size={14} className="text-slate-500" />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label} ({lang.native})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mark as Done */}
                {activeMaterial && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(
                      activeMaterial.topicId,
                      activeMaterial.status === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED'
                    )}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs ${
                      activeMaterial.status === 'COMPLETED'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-800'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    {activeMaterial.status === 'COMPLETED' ? 'Completed' : 'Mark as Done'}
                  </button>
                )}

                {/* Open in Dedicated Browser Tab */}
                {activeMaterial && (
                  <a
                    href={`/app/papers/${encodeURIComponent(documentId)}/topics/${encodeURIComponent(activeMaterial.topicId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 flex items-center gap-1 shadow-2xs"
                    title="Open in a separate browser tab"
                  >
                    <ExternalLink size={13} />
                    <span className="hidden sm:inline">New Tab</span>
                  </a>
                )}

                {/* Close button */}
                <button
                  type="button"
                  onClick={handleCloseExtraPage}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                  aria-label="Close extra page"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </header>

          {/* Extra Page Main Content Area */}
          <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-8">
            {materialLoading ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center space-y-4 shadow-sm">
                <LoaderCircle className="animate-spin text-blue-600 mx-auto" size={36} />
                <h3 className="text-lg font-black text-slate-900">Loading Topic Learning Details…</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Extracting definitions, step-by-step guides, mind maps, and examples directly from your document.
                </p>
              </div>
            ) : !activeMaterial ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center space-y-4 shadow-sm">
                <BookOpen className="text-slate-400 mx-auto" size={40} />
                <h3 className="text-lg font-black text-slate-900">No Topic Selected</h3>
                <button
                  onClick={handleCloseExtraPage}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
                >
                  Return to Topics
                </button>
              </div>
            ) : (
              <article className="space-y-8">
                {/* Header Banner */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-widest text-blue-600 block mb-1">
                        {activeMaterial.chapterTitle || 'Course Module'}
                      </span>
                      <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                        {activeMaterial.topicTitle}
                      </h1>
                    </div>

                    {/* Read Aloud Button */}
                    <button
                      type="button"
                      onClick={() => speakInLanguage(
                        `${activeMaterial.topicTitle}. ${getConceptTranslation(activeMaterial.topicTitle, activeMaterial.simpleDefinition, language)}. ${activeMaterial.easyExplanation}`,
                        language
                      )}
                      className="px-3.5 py-2 rounded-xl text-xs font-extrabold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 transition-colors shadow-2xs"
                      title="Read topic explanation aloud"
                    >
                      <Volume2 size={16} /> {t('Listen to Explanation', language)}
                    </button>
                  </div>

                  {/* 1. Simple Meaning Card */}
                  <div className="bg-blue-50/80 border border-blue-200/90 rounded-2xl p-5 space-y-2">
                    <span className="text-xs font-extrabold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Lightbulb size={16} /> {t('Simple Meaning', language)}
                    </span>
                    <p className="text-base sm:text-lg font-bold text-blue-950 leading-relaxed">
                      {getConceptTranslation(activeMaterial.topicTitle, activeMaterial.simpleDefinition, language)}
                    </p>
                  </div>
                </div>

                {/* 2. Easy Plain-English Explanation */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Sparkles className="text-blue-600" size={18} />
                    <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                      Easy Explanation (In Student-Friendly Plain English)
                    </h2>
                  </div>
                  <p className="text-base text-slate-800 leading-loose whitespace-pre-line font-normal">
                    {activeMaterial.easyExplanation}
                  </p>
                </div>

                {/* 3. Interactive Concept Diagram */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Network className="text-blue-600" size={18} />
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                        Interactive Concept Diagram & Mind Map
                      </h2>
                    </div>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                      💡 Click any box or word in diagram to see simple meaning & audio
                    </span>
                  </div>
                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex items-center justify-center overflow-x-auto min-h-[240px]">
                    <MermaidDiagram
                      chart={getTopicDiagram(activeMaterial)}
                      glossary={getTopicGlossary(activeMaterial)}
                      id={`extra-topic-diagram-${activeMaterial.topicId}`}
                    />
                  </div>
                </div>

                {/* 4. Step-by-Step Breakdown */}
                {activeMaterial.stepByStepExplanation?.length > 0 && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <ListOrdered className="text-amber-500" size={18} />
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                        Step-by-Step Breakdown
                      </h2>
                    </div>
                    <div className="space-y-3">
                      {activeMaterial.stepByStepExplanation.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                          <span className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                            {idx + 1}
                          </span>
                          <p className="text-sm text-slate-800 leading-relaxed font-medium pt-1">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Real-World Analogy & Industry Examples */}
                {activeMaterial.realWorldExample && (
                  <div className="bg-amber-50/70 border-l-4 border-amber-500 rounded-3xl border-y border-r border-amber-200 p-6 sm:p-8 shadow-sm space-y-3">
                    <h2 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-2">
                      <Zap size={18} className="text-amber-600" /> Real-World Analogy & Practical Application
                    </h2>
                    <p className="text-sm sm:text-base text-slate-800 leading-relaxed italic font-medium">
                      "{activeMaterial.realWorldExample}"
                    </p>
                  </div>
                )}

                {/* 6. Key Takeaways */}
                {activeMaterial.importantPoints?.length > 0 && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <CheckCircle2 className="text-emerald-600" size={18} />
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                        Key Takeaways & Core Concepts
                      </h2>
                    </div>
                    <ul className="space-y-2.5">
                      {activeMaterial.importantPoints.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-slate-800 leading-relaxed">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 7. Vocabulary & Difficult Terms */}
                {activeMaterial.difficultWords?.length > 0 && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <HelpCircle className="text-rose-500" size={18} />
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                        Vocabulary & Difficult Terms
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeMaterial.difficultWords.map((item, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-blue-700 font-mono">{item.word}</span>
                            <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-bold uppercase">Term</span>
                          </div>
                          <p className="text-xs font-bold text-slate-900 leading-snug">{item.simpleMeaning}</p>
                          {item.explanation && (
                            <p className="text-xs text-slate-600 leading-relaxed">{item.explanation}</p>
                          )}
                          {item.example && (
                            <p className="text-xs text-amber-800 italic bg-amber-50 p-2 rounded-xl border border-amber-200">
                              Example: {item.example}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Navigation Bar at Bottom */}
                <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6" aria-label="Extra page topic navigation">
                  {prevTopic ? (
                    <button
                      type="button"
                      onClick={() => handleNavigateExtraTopic(prevTopic.id)}
                      className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 hover:text-blue-700 bg-white border border-slate-200 px-4 py-3 rounded-2xl transition-all shadow-2xs"
                    >
                      <ArrowLeft size={16} /> Previous: {prevTopic.name}
                    </button>
                  ) : (
                    <div />
                  )}

                  <button
                    type="button"
                    onClick={handleCloseExtraPage}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2"
                  >
                    Back to Document Overview
                  </button>

                  {nextTopic && (
                    <button
                      type="button"
                      onClick={() => handleNavigateExtraTopic(nextTopic.id)}
                      style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                      className="inline-flex items-center gap-2 text-xs font-extrabold px-5 py-3 rounded-2xl shadow-sm transition-all ml-auto hover:bg-blue-700"
                    >
                      Next: {nextTopic.name} <ArrowRight size={16} />
                    </button>
                  )}
                </nav>
              </article>
            )}
          </main>
        </div>
      )}
    </div>
  )
}
