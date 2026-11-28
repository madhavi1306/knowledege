import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  Flame,
  HelpCircle,
  Layers,
  Lightbulb,
  ListOrdered,
  LoaderCircle,
  RefreshCw,
  Repeat,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import MermaidDiagram from '../components/MermaidDiagram.jsx'
import { apiRequest } from '../services/api.js'

export default function SpacedRepetitionPage() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('weak_topics') // 'weak_topics', 'flashcards', 'quick_notes'

  // Document & library state
  const [documents, setDocuments] = useState([])
  const [selectedDocId, setSelectedDocId] = useState('')
  const [docTopics, setDocTopics] = useState([])

  // Weak topics & adaptive revision state
  const [weakTopics, setWeakTopics] = useState([])
  const [activeRecord, setActiveRecord] = useState(null)
  const [reteachData, setReteachData] = useState(null)
  const [reteachLoading, setReteachLoading] = useState(false)
  const [practiceAnswers, setPracticeAnswers] = useState({})
  const [practiceRevealed, setPracticeRevealed] = useState({})

  // Retest state
  const [retestSession, setRetestSession] = useState(null)
  const [retestAnswers, setRetestAnswers] = useState({})
  const [retestSubmitting, setRetestSubmitting] = useState(false)
  const [retestResults, setRetestResults] = useState(null)

  // Spaced Repetition (FSRS) queue state
  const [queueData, setQueueData] = useState({ due: [], upcoming: [], dueCount: 0, totalTracked: 0 })
  const [activeCard, setActiveCard] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [submittingRating, setSubmittingRating] = useState(false)

  // Quick revision notes state
  const [notesData, setNotesData] = useState([])
  const [loadingNotes, setLoadingNotes] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 1. Initial Load: Documents, Weak Topics, FSRS Queue
  useEffect(() => {
    async function init() {
      try {
        setLoading(true)
        setError('')

        const [docsRes, fsrsRes] = await Promise.all([
          apiRequest('/api/documents').catch(() => ({ items: [] })),
          apiRequest('/api/spaced-repetition/queue').catch(() => ({ due: [], upcoming: [], dueCount: 0, totalTracked: 0 })),
        ])

        const docs = docsRes.items || []
        setDocuments(docs)
        setQueueData(fsrsRes)

        if (fsrsRes.due && fsrsRes.due.length > 0) {
          setActiveCard(fsrsRes.due[0])
        }

        const initialDocId = docs[0]?.id || ''
        setSelectedDocId(initialDocId)

        if (initialDocId) {
          await Promise.allSettled([
            loadWeakTopicsForDoc(initialDocId),
            loadDocumentNotes(initialDocId),
          ])
        } else {
          await loadAllWeakTopics().catch(() => {})
        }
      } catch (err) {
        setError(err.message || 'Failed to initialize revision hub.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  // 2. Load weak topics for a document
  async function loadWeakTopicsForDoc(docId) {
    if (!docId) return
    try {
      const res = await apiRequest(`/api/adaptive/${encodeURIComponent(docId)}/weak-topics`).catch(() => ({ weakTopics: [] }))
      const list = res.weakTopics || []
      setWeakTopics(list)
      if (list.length > 0) {
        selectWeakTopic(list[0])
      } else {
        setActiveRecord(null)
        setReteachData(null)
      }
    } catch (err) {
      setWeakTopics([])
    }
  }

  // Load weak topics across all documents
  async function loadAllWeakTopics() {
    try {
      const res = await apiRequest('/api/adaptive/weak-topics').catch(() => ({ weakTopics: [] }))
      const list = res.weakTopics || []
      setWeakTopics(list)
      if (list.length > 0) {
        selectWeakTopic(list[0])
      } else {
        setActiveRecord(null)
        setReteachData(null)
      }
    } catch {
      setWeakTopics([])
    }
  }

  // Load quick chapter notes
  async function loadDocumentNotes(docId) {
    if (!docId) return
    setLoadingNotes(true)
    try {
      const res = await apiRequest(`/api/learning/${encodeURIComponent(docId)}`).catch(() => ({ topics: [] }))
      setDocTopics(res.topics || [])
      const materials = (res.topics || []).filter((t) => t.hasGeneratedMaterial && t.learningMaterial).map((t) => t.learningMaterial)
      setNotesData(materials)
    } catch {
      setDocTopics([])
      setNotesData([])
    } finally {
      setLoadingNotes(false)
    }
  }

  // Handle document switch
  async function handleDocChange(e) {
    const docId = e.target.value
    setSelectedDocId(docId)
    setRetestSession(null)
    setRetestResults(null)
    if (docId) {
      await loadWeakTopicsForDoc(docId)
      await loadDocumentNotes(docId)
    } else {
      await loadAllWeakTopics()
    }
  }

  // 3. Select weak topic & load adaptive reteach
  async function selectWeakTopic(record) {
    setActiveRecord(record)
    setRetestSession(null)
    setRetestResults(null)
    setRetestAnswers({})
    setPracticeAnswers({})
    setPracticeRevealed({})
    setReteachLoading(true)

    try {
      const res = await apiRequest(`/api/adaptive/records/${encodeURIComponent(record.id)}/reteach`)
      setReteachData(res.adaptiveReteach)
      setActiveRecord(res.record)
    } catch (err) {
      setError(err.message || 'Failed to load adaptive reteach.')
    } finally {
      setReteachLoading(false)
    }
  }

  // 4. Start Targeted Retest
  async function handleStartRetest() {
    if (!activeRecord) return
    try {
      setReteachLoading(true)
      const res = await apiRequest(`/api/adaptive/records/${encodeURIComponent(activeRecord.id)}/retest`, {
        method: 'POST',
      })
      setRetestSession(res.session)
      setRetestAnswers({})
      setRetestResults(null)
    } catch (err) {
      setError(err.message || 'Failed to generate retest.')
    } finally {
      setReteachLoading(false)
    }
  }

  // 5. Submit Retest Evaluation
  async function handleSubmitRetest() {
    if (!retestSession || retestSubmitting) return
    try {
      setRetestSubmitting(true)
      const res = await apiRequest(`/api/adaptive/sessions/${encodeURIComponent(retestSession.id)}/retest-submit`, {
        method: 'POST',
        body: { answers: retestAnswers },
      })
      setRetestResults(res.results)
      setActiveRecord(res.weakTopicRecord)
      if (selectedDocId) {
        await loadWeakTopicsForDoc(selectedDocId)
      } else {
        await loadAllWeakTopics()
      }
    } catch (err) {
      setError(err.message || 'Failed to submit retest.')
    } finally {
      setRetestSubmitting(false)
    }
  }

  // 6. Spaced Repetition (FSRS) Rating Handler
  async function handleRating(rating) {
    if (!activeCard) return
    setSubmittingRating(true)
    try {
      await apiRequest('/api/spaced-repetition/review', {
        method: 'POST',
        body: { conceptId: activeCard.conceptId, rating },
      })
      const remaining = queueData.due.filter((item) => item.conceptId !== activeCard.conceptId)
      setQueueData((prev) => ({ ...prev, due: remaining, dueCount: remaining.length }))
      if (remaining.length > 0) {
        setActiveCard(remaining[0])
        setShowAnswer(false)
      } else {
        setActiveCard(null)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmittingRating(false)
    }
  }

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-500 gap-3">
        <LoaderCircle className="spin text-indigo-600" size={32} />
        <p className="text-xs font-semibold">Loading your revision and memory consolidation hub…</p>
      </div>
    )
  }

  const resolvedCount = weakTopics.filter((t) => t.status === 'RESOLVED' || t.status === 'RETESTED').length
  const avgImprovement = weakTopics.length > 0
    ? Math.round(weakTopics.reduce((acc, t) => acc + (t.improvementDelta || 0), 0) / weakTopics.length)
    : 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* 1. Revision Hub Header & KPI Stats */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5 mb-1">
            <Sparkles size={14} className="text-indigo-500" />
            Adaptive Learning & Memory Consolidation
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Revision & Mastery Hub
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Revise weak concepts through step-by-step reteach, practice micro-checks, and cement recall with FSRS spaced repetition.
          </p>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <Target size={16} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Weak Topics</span>
              <span className="text-base font-extrabold text-slate-900">{weakTopics.length}</span>
            </div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Mastered</span>
              <span className="text-base font-extrabold text-slate-900">{resolvedCount}</span>
            </div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock size={16} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Cards Due</span>
              <span className="text-base font-extrabold text-slate-900">{queueData.dueCount}</span>
            </div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Flame size={16} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Avg Boost</span>
              <span className="text-base font-extrabold text-emerald-600">+{avgImprovement}%</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Clean Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('weak_topics')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
            activeTab === 'weak_topics'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Target size={15} /> Weak Topics Revision & Retest ({weakTopics.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('flashcards')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
            activeTab === 'flashcards'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap size={15} /> Daily Flashcards & FSRS ({queueData.dueCount} Due)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('quick_notes')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
            activeTab === 'quick_notes'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen size={15} /> Chapter Revision Takeaways
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* =========================================================
          TAB 1: WEAK TOPICS REVISION & ADAPTIVE RETEST
          ========================================================= */}
      {activeTab === 'weak_topics' && (
        <div className="space-y-6">
          {/* Document Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Filter by Paper / Notes:
              </label>
              <div className="relative min-w-[260px]">
                <select
                  value={selectedDocId}
                  onChange={handleDocChange}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                >
                  <option value="">All Uploaded Documents</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ')} ({d.fileName})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (selectedDocId ? loadWeakTopicsForDoc(selectedDocId) : loadAllWeakTopics())}
                className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
                title="Refresh diagnostics"
              >
                <RefreshCw size={13} /> Refresh Diagnostics
              </button>
              <Link
                to="/app/quizzes"
                className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <ClipboardCheck size={13} /> Take New Test
              </Link>
            </div>
          </div>

          {/* Master-Detail Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Weak Topics List */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Identified Weak Topics ({weakTopics.length})
                </span>
                <span className="text-[11px] font-semibold text-slate-400">Scores &lt; 70%</span>
              </div>

              {weakTopics.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">No Weak Topics Detected!</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    You have demonstrated high mastery across tested chapters, or have not taken an assessment yet.
                  </p>
                  <Link
                    to="/app/quizzes"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl shadow-xs"
                  >
                    <ClipboardCheck size={14} /> Take a Practice Test
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
                  {weakTopics.map((item) => {
                    const isSelected = activeRecord?.id === item.id
                    const isRetested = item.status === 'RETESTED' || item.status === 'RESOLVED'

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectWeakTopic(item)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-2 ${
                          isSelected
                            ? 'bg-white border-rose-500 shadow-md ring-2 ring-rose-500/20'
                            : isRetested
                            ? 'bg-emerald-50/30 border-emerald-200 hover:bg-white text-slate-700'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {item.topicName}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              isRetested
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'REPEATED_DIFFICULTY'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-500">
                            Current Score: <strong className={item.currentScore >= 70 ? 'text-emerald-600' : 'text-rose-600'}>{item.currentScore}%</strong>
                          </span>
                          {item.improvementDelta > 0 && (
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              +{item.improvementDelta}% Delta
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {item.detectionReason}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right: Adaptive Reteach & Retest Studio */}
            <div className="lg:col-span-8">
              {reteachLoading ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <LoaderCircle className="spin text-rose-600" size={28} />
                  <span className="text-xs font-semibold">Generating adaptive reteach explanation…</span>
                </div>
              ) : activeRecord && reteachData ? (
                <div className="space-y-6">
                  {/* Reteach Header Banner */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                          <Target size={14} /> Adaptive Reteach
                        </span>
                        <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                          {activeRecord.topicName}
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={handleStartRetest}
                        className="button button-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow-xs"
                      >
                        <RotateCcw size={14} /> Retest This Topic
                      </button>
                    </div>

                    {/* Diagnostic Reason */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                      <HelpCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block mb-0.5">Why this was flagged:</strong>
                        <span>{activeRecord.detectionReason}</span>
                      </div>
                    </div>
                  </div>

                  {/* Adaptive Content Cards */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    {/* 1. Simpler Words Definition */}
                    <section className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <Lightbulb size={15} className="text-amber-500" />
                        1. Simplified Explanation (Everyday English)
                      </h3>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs font-medium text-slate-800 leading-relaxed">
                        {reteachData.simplerWords}
                      </div>
                    </section>

                    {/* 2. Micro-Steps */}
                    {reteachData.microSteps && reteachData.microSteps.length > 0 && (
                      <section className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <ListOrdered size={15} className="text-indigo-600" />
                          2. Step-by-Step Micro-Breakdown
                        </h3>
                        <div className="space-y-2">
                          {reteachData.microSteps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs text-slate-700">
                              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="leading-relaxed">{step}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* 3. New Real-World Analogy */}
                    {reteachData.differentAnalogy && (
                      <section className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <Sparkles size={15} className="text-purple-600" />
                          3. Real-World Analogy
                        </h3>
                        <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200/70 text-xs font-medium text-purple-950 leading-relaxed">
                          {reteachData.differentAnalogy}
                        </div>
                      </section>
                    )}

                    {/* 4. Simplified Diagram */}
                    {reteachData.simplifiedDiagram && (
                      <section className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <Layers size={15} className="text-emerald-600" />
                          4. Simplified Concept Flowchart
                        </h3>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <MermaidDiagram code={reteachData.simplifiedDiagram} />
                        </div>
                      </section>
                    )}

                    {/* 5. Practice Check Questions */}
                    {reteachData.practiceQuestions && reteachData.practiceQuestions.length > 0 && (
                      <section className="space-y-3 pt-2 border-t border-slate-100">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <CheckCircle2 size={15} className="text-emerald-600" />
                          5. Quick Comprehension Practice Checks
                        </h3>
                        <div className="space-y-4">
                          {reteachData.practiceQuestions.map((q, qIdx) => {
                            const isRevealed = practiceRevealed[qIdx]
                            return (
                              <div key={qIdx} className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3 text-xs">
                                <p className="font-bold text-slate-900">{q.questionText}</p>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    placeholder="Type your answer…"
                                    value={practiceAnswers[qIdx] || ''}
                                    onChange={(e) => setPracticeAnswers((prev) => ({ ...prev, [qIdx]: e.target.value }))}
                                    className="flex-1 text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setPracticeRevealed((prev) => ({ ...prev, [qIdx]: true }))}
                                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 rounded-lg transition-colors"
                                  >
                                    Check Answer
                                  </button>
                                </div>
                                {isRevealed && (
                                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs">
                                    <strong className="block mb-1">Correct Answer: {q.correctAnswer}</strong>
                                    <span>{q.explanation}</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </section>
                    )}
                  </div>

                  {/* Retest Active Session */}
                  {retestSession && (
                    <div className="bg-white rounded-2xl border-2 border-indigo-500 shadow-md p-6 space-y-6">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                            Active Retest Evaluation
                          </span>
                          <h3 className="text-base font-bold text-slate-900">
                            {retestSession.totalQuestions} Verification Questions for "{activeRecord.topicName}"
                          </h3>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                          {Object.keys(retestAnswers).length} / {retestSession.totalQuestions} Answered
                        </span>
                      </div>

                      <div className="space-y-5">
                        {retestSession.questions?.map((q, idx) => (
                          <div key={q.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                              Question {idx + 1} • {q.type.replace(/_/g, ' ')}
                            </span>
                            <p className="font-bold text-slate-900">{q.questionText}</p>

                            {q.options && q.options.length > 0 ? (
                              <div className="space-y-1.5">
                                {q.options.map((opt, oIdx) => (
                                  <label
                                    key={oIdx}
                                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                      retestAnswers[q.id] === opt ? 'bg-indigo-50 border-indigo-600 text-indigo-950 font-semibold' : 'bg-white border-slate-200'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={q.id}
                                      value={opt}
                                      checked={retestAnswers[q.id] === opt}
                                      onChange={() => setRetestAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                      className="text-indigo-600"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <input
                                type="text"
                                placeholder="Type your answer…"
                                value={retestAnswers[q.id] || ''}
                                onChange={(e) => setRetestAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleSubmitRetest}
                        disabled={retestSubmitting}
                        className="button button-primary w-full py-3 text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
                      >
                        {retestSubmitting ? (
                          <>
                            <LoaderCircle className="spin" size={15} /> Evaluating Retest…
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={15} /> Submit Retest & Verify Improvement
                          </>
                        )}
                      </button>

                      {retestResults && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-950">
                          <strong className="text-sm block">Retest Score: {retestResults.newScore}%</strong>
                          <p>
                            Previous Score: {retestResults.previousScore}% • Improvement Delta: +{retestResults.improvementDelta}%
                          </p>
                          <span className="font-bold">Status: {retestResults.newStatus}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-500 text-xs">
                  <BookOpen size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold">Select a weak topic on the left to begin targeted revision.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 2: DAILY FLASHCARDS & FSRS SPACED REPETITION
          ========================================================= */}
      {activeTab === 'flashcards' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-900 block">Free Spaced Repetition Scheduler (FSRS)</span>
              <span className="text-slate-500 text-[11px]">
                Active review cards calculated dynamically based on stability and memory retrieval decay.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs">
                {queueData.dueCount} Cards Due
              </span>
            </div>
          </div>

          {activeCard ? (
            <motion.div
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-2xl mx-auto space-y-6"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                  {activeCard.topicName}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  Est. Retention: {Math.round(activeCard.retentionScore * 100)}%
                </span>
              </div>

              <div className="space-y-2 text-center py-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">RECALL PROMPT</span>
                <h3 className="text-xl font-bold text-slate-900">{activeCard.conceptName}</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  How would you define this concept and articulate its core mechanics?
                </p>
              </div>

              {showAnswer ? (
                <motion.div
                  className="space-y-4 pt-4 border-t border-slate-100 text-xs"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <strong className="block text-slate-900 mb-1">Core Definition:</strong>
                    <p className="text-slate-700 leading-relaxed">{activeCard.definition}</p>
                  </div>
                  {activeCard.simpleExplanation && (
                    <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-indigo-950">
                      <strong className="block mb-1">Simple Intuition:</strong>
                      <p className="leading-relaxed">{activeCard.simpleExplanation}</p>
                    </div>
                  )}
                  {activeCard.analogy && (
                    <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-purple-950">
                      <strong className="block mb-1">Analogy:</strong>
                      <p className="leading-relaxed">{activeCard.analogy}</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    className="button button-secondary px-6 py-2.5 text-xs font-bold"
                    onClick={() => setShowAnswer(true)}
                  >
                    Reveal Verified Answer
                  </button>
                </div>
              )}

              {showAnswer && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-700 block text-center">
                    Rate your recall difficulty:
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      className="p-2.5 text-xs font-bold rounded-xl border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 transition-colors"
                      onClick={() => handleRating(1)}
                      disabled={submittingRating}
                    >
                      1: Again (Forgot)
                    </button>
                    <button
                      type="button"
                      className="p-2.5 text-xs font-bold rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
                      onClick={() => handleRating(2)}
                      disabled={submittingRating}
                    >
                      2: Hard
                    </button>
                    <button
                      type="button"
                      className="p-2.5 text-xs font-bold rounded-xl border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors"
                      onClick={() => handleRating(3)}
                      disabled={submittingRating}
                    >
                      3: Good (Solid)
                    </button>
                    <button
                      type="button"
                      className="p-2.5 text-xs font-bold rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
                      onClick={() => handleRating(4)}
                      disabled={submittingRating}
                    >
                      4: Easy
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center max-w-xl mx-auto space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-base font-bold text-slate-900">All Due Flashcards Completed!</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Your memory intervals have been recalculated with FSRS. Concepts will resurface just before you are about to forget them.
              </p>

              {queueData.upcoming && queueData.upcoming.length > 0 && (
                <div className="pt-4 border-t border-slate-100 text-left">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Upcoming Scheduled Reviews:
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {queueData.upcoming.slice(0, 4).map((item) => (
                      <div key={item.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-0.5">
                        <strong className="text-slate-800 truncate">{item.conceptName}</strong>
                        <span className="text-[10px] text-slate-400">
                          Due: {new Date(item.nextReviewDate).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          TAB 3: CHAPTER QUICK REVISION NOTES
          ========================================================= */}
      {activeTab === 'quick_notes' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Paper:
              </label>
              <div className="relative min-w-[260px]">
                <select
                  value={selectedDocId}
                  onChange={handleDocChange}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ')}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {loadingNotes ? (
            <div className="py-12 flex justify-center text-slate-400">
              <LoaderCircle className="spin" size={24} />
            </div>
          ) : notesData.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
              <BookOpen size={28} className="mx-auto text-slate-300 mb-2" />
              <p>No chapter notes found for this paper yet. Open the paper in "Learn" mode to generate notes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notesData.map((note) => (
                <div key={note.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {note.chapterTitle}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">{note.topicTitle}</span>
                  </div>

                  <p className="font-semibold text-slate-800 leading-relaxed">{note.simpleDefinition}</p>

                  {note.quickRevisionNotes && note.quickRevisionNotes.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Key Takeaways:</span>
                      <ul className="list-disc list-inside space-y-1 text-slate-600">
                        {note.quickRevisionNotes.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {note.keyThingsToRemember && note.keyThingsToRemember.length > 0 && (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-amber-900 text-[11px]">
                      <strong className="block mb-0.5">Remember for exams:</strong>
                      <span>{note.keyThingsToRemember[0]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
