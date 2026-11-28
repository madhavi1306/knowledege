import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileText,
  HelpCircle,
  History,
  Layers,
  ListOrdered,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'

export default function DocumentAssessmentPage() {
  const { documentId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Data state
  const [document, setDocument] = useState(null)
  const [topics, setTopics] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Launcher state
  const [scope, setScope] = useState(searchParams.get('scope') || (searchParams.get('topicId') ? 'TOPIC' : 'DOCUMENT'))
  const [selectedTopicId, setSelectedTopicId] = useState(searchParams.get('topicId') || '')
  const [selectedChapter, setSelectedChapter] = useState('')
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [questionCount, setQuestionCount] = useState(5)
  const [generating, setGenerating] = useState(false)

  // Active Test state
  const [activeSession, setActiveSession] = useState(null)
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState(null)

  // 1. Load initial document data & test history
  async function loadData() {
    try {
      setLoading(true)
      const [docRes, learnRes, histRes] = await Promise.all([
        apiRequest(`/api/documents/${encodeURIComponent(documentId)}`),
        apiRequest(`/api/learning/${encodeURIComponent(documentId)}`).catch(() => ({ topics: [] })),
        apiRequest(`/api/assessments/${encodeURIComponent(documentId)}/history`).catch(() => ({ history: [] })),
      ])

      setDocument(docRes.document)
      setTopics(learnRes.topics || [])
      setHistory(histRes.history || [])

      if (learnRes.topics?.length > 0 && !selectedTopicId) {
        setSelectedTopicId(learnRes.topics[0].id)
      }
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to load assessment information.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [documentId])

  // Extract unique chapters
  const chapters = Array.from(new Set(topics.map((t) => t.chapterTitle).filter(Boolean)))

  // 2. Start a new test
  async function handleStartTest() {
    try {
      setGenerating(true)
      setError('')
      const res = await apiRequest(`/api/assessments/${encodeURIComponent(documentId)}/generate`, {
        method: 'POST',
        body: {
          scope,
          topicId: scope === 'TOPIC' ? selectedTopicId : null,
          chapterTitle: scope === 'CHAPTER' ? selectedChapter || chapters[0] : null,
          difficulty,
          questionCount: Number(questionCount),
        },
      })

      setActiveSession(res.session)
      setCurrentQIndex(0)
      setAnswers({})
      setResults(null)
    } catch (err) {
      setError(err.message || 'Failed to generate assessment.')
    } finally {
      setGenerating(false)
    }
  }

  // 3. Submit completed test
  async function handleSubmitTest() {
    if (!activeSession || submitting) return
    try {
      setSubmitting(true)
      setError('')
      const res = await apiRequest(`/api/assessments/sessions/${encodeURIComponent(activeSession.id)}/submit`, {
        method: 'POST',
        body: { answers },
      })

      setActiveSession(res.session)
      setResults(res.results)
      // Refresh test history
      const histRes = await apiRequest(`/api/assessments/${encodeURIComponent(documentId)}/history`).catch(() => null)
      if (histRes?.history) setHistory(histRes.history)
    } catch (err) {
      setError(err.message || 'Failed to submit test.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleAnswerSelect(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to={`/app/papers/${encodeURIComponent(documentId)}/learn`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft size={14} /> Back to Learning
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                <ClipboardCheck size={13} /> Phase 7 Topic-Wise Assessment
              </span>
              <h1 className="text-base font-bold text-slate-900 line-clamp-1">
                {document?.fileName || 'Document Assessment'}
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
              to={`/app/papers/${encodeURIComponent(documentId)}/visuals`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition-colors"
            >
              <Layers size={14} /> Visuals
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto w-full flex-1 p-6 flex flex-col gap-6">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
            <LoaderCircle className="animate-spin text-indigo-600" size={32} />
            <span className="text-xs font-medium text-slate-600">Loading assessment workspace…</span>
          </div>
        ) : error && !activeSession ? (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <p>{error}</p>
          </div>
        ) : !activeSession ? (
          /* ========================================================
             1. TEST CONFIGURATOR & LAUNCHER SCREEN
             ======================================================== */
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block mb-1">
                  Custom Grounded Assessment
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  Assess Your Understanding
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate grounded questions directly from your uploaded document. Test multiple choice, true/false, fill in the blanks, and conceptual reasoning.
                </p>
              </div>

              {/* Scope Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  1. Select Assessment Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setScope('TOPIC')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      scope === 'TOPIC'
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-900 block">Single Topic</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">Focused test on one specific topic</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('CHAPTER')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      scope === 'CHAPTER'
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-900 block">Chapter / Section</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">Covers all topics in a chapter</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('DOCUMENT')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      scope === 'DOCUMENT'
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-900 block">Full Document</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">Comprehensive exam across all topics</span>
                  </button>
                </div>
              </div>

              {/* Specific Topic / Chapter selection */}
              {scope === 'TOPIC' && topics.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Select Topic to Test:</label>
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-indigo-500"
                  >
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name || t.topicTitle} {t.chapterTitle ? `(${t.chapterTitle})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scope === 'CHAPTER' && chapters.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Select Chapter:</label>
                  <select
                    value={selectedChapter || chapters[0]}
                    onChange={(e) => setSelectedChapter(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-indigo-500"
                  >
                    {chapters.map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Difficulty and Question Count */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    2. Difficulty Level
                  </label>
                  <div className="flex gap-2">
                    {['EASY', 'MEDIUM', 'HARD'].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setDifficulty(lvl)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                          difficulty === lvl
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    3. Number of Questions
                  </label>
                  <div className="flex gap-2">
                    {[5, 10, 15, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setQuestionCount(num)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                          Number(questionCount) === num
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {num} Qs
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Launch Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStartTest}
                  disabled={generating}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generating ? <LoaderCircle className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  {generating ? 'Generating Grounded Questions from PDF…' : 'Generate & Begin Assessment'}
                </button>
              </div>
            </div>

            {/* Past Test History */}
            {history.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <History size={16} className="text-indigo-600" />
                    Previous Assessment Attempts ({history.length})
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.topicName}</span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                            {item.scope}
                          </span>
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded">
                            {item.difficulty}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          Attempted {new Date(item.completedAt).toLocaleDateString()} at{' '}
                          {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className={`text-sm font-extrabold ${item.scorePercentage >= 80 ? 'text-emerald-600' : item.scorePercentage >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {item.scorePercentage}%
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {item.correctCount} / {item.totalQuestions} correct
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : !results ? (
          /* ========================================================
             2. ACTIVE TEST INTERFACE (Anti-cheating / No answers revealed)
             ======================================================== */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            {/* Header with Progress */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  {activeSession.topicName} • {activeSession.difficulty}
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Question {currentQIndex + 1} of {activeSession.questions.length}
                </h2>
              </div>

              {/* Progress Pill */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  {Object.keys(answers).length} / {activeSession.questions.length} Answered
                </span>
                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${(Object.keys(answers).length / activeSession.questions.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Question Card */}
            {(() => {
              const q = activeSession.questions[currentQIndex]
              if (!q) return null
              const currentAns = answers[q.id] || ''

              return (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
                      {q.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      🎯 {q.topicName || 'Chapter Concept'}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-slate-900 leading-relaxed">
                    {q.questionText}
                  </p>

                  {/* Options Renderer */}
                  {q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE' ? (
                    <div className="space-y-2.5">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = currentAns === opt
                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => handleAnswerSelect(q.id, opt)}
                            className={`w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-all flex items-start gap-3 ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-950 ring-2 ring-indigo-500/20 font-semibold'
                                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full border mt-0.5 shrink-0 flex items-center justify-center ${
                                isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </span>
                            <span className="leading-relaxed">{opt}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : q.type === 'FILL_IN_BLANKS' ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600 block">Type the missing word or phrase:</label>
                      <input
                        type="text"
                        value={currentAns}
                        onChange={(e) => handleAnswerSelect(q.id, e.target.value)}
                        placeholder="Enter the missing term…"
                        className="w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600 block">Write your concise answer:</label>
                      <textarea
                        rows={3}
                        value={currentAns}
                        onChange={(e) => handleAnswerSelect(q.id, e.target.value)}
                        placeholder="Enter your explanation based on the document…"
                        className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
                      />
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Navigation & Submission Controls */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
                disabled={currentQIndex === 0}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> Previous
              </button>

              <div className="flex items-center gap-2">
                {currentQIndex < activeSession.questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQIndex((i) => Math.min(activeSession.questions.length - 1, i + 1))}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                  >
                    Next <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitTest}
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
                  >
                    {submitting ? <LoaderCircle className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                    Submit Assessment
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================
             3. RESULTS & PERFORMANCE REVIEW SCREEN
             ======================================================== */
          <div className="space-y-6">
            {/* Score Banner */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
              <div
                className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
                  results.scorePercentage >= 80
                    ? 'bg-emerald-50 text-emerald-600'
                    : results.scorePercentage >= 50
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                {results.scorePercentage >= 80 ? <Trophy size={32} /> : <Award size={32} />}
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Assessment Complete
                </span>
                <h2 className="text-3xl font-extrabold text-slate-900">
                  {results.scorePercentage}%
                </h2>
                <p className="text-xs font-medium text-slate-600 mt-1">
                  You answered {results.correctCount} out of {results.totalQuestions} questions correctly.
                </p>
              </div>

              {/* Stat Grid */}
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto pt-2">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total</span>
                  <span className="text-base font-extrabold text-slate-800">{results.totalQuestions}</span>
                </div>
                <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase block">Correct</span>
                  <span className="text-base font-extrabold text-emerald-700">{results.correctCount}</span>
                </div>
                <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100">
                  <span className="text-[10px] text-rose-700 font-bold uppercase block">Incorrect</span>
                  <span className="text-base font-extrabold text-rose-700">{results.incorrectCount}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <Link
                  to={`/app/papers/${encodeURIComponent(documentId)}/adaptive`}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <RotateCcw size={14} /> Revise Weak Topics
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSession(null)
                    setResults(null)
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <RotateCcw size={14} /> New Assessment
                </button>
                <Link
                  to={`/app/papers/${encodeURIComponent(documentId)}/learn`}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <BookOpen size={14} /> Return to Notes
                </Link>
              </div>
            </div>

            {/* Topic Performance Breakdown */}
            {results.topicPerformance?.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Topic Mastery Performance
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.topicPerformance.map((tp, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                        tp.status === 'STRONG'
                          ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                          : tp.status === 'IMPROVING'
                          ? 'bg-amber-50/40 border-amber-200 text-amber-950'
                          : 'bg-rose-50/40 border-rose-200 text-rose-950'
                      }`}
                    >
                      <div>
                        <h4 className="font-bold text-slate-900">{tp.topicName}</h4>
                        <span className="text-[11px] opacity-75">
                          {tp.correctCount} / {tp.totalQuestions} questions correct
                        </span>
                      </div>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          tp.status === 'STRONG'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tp.status === 'IMPROVING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {tp.scorePercentage}% • {tp.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Question-by-Question Review */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Detailed Answer Review ({activeSession.questions.length} questions)
              </h3>

              <div className="space-y-4">
                {activeSession.questions.map((q, idx) => {
                  const isCorrect = q.isCorrect

                  return (
                    <div
                      key={q.id || idx}
                      className={`p-4 rounded-xl border text-xs space-y-3 ${
                        isCorrect ? 'bg-emerald-50/20 border-emerald-200' : 'bg-rose-50/20 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          {isCorrect ? (
                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle size={16} className="text-rose-600 shrink-0" />
                          )}
                          Question {idx + 1} • {q.topicName}
                        </span>
                        <a
                          href={`/api/documents/${encodeURIComponent(documentId)}/file#page=${q.pageNumber || 1}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded transition-colors"
                        >
                          <FileText size={11} /> Page {q.pageNumber || 1}
                        </a>
                      </div>

                      <p className="font-semibold text-slate-800">{q.questionText}</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Your Answer</span>
                          <span className={`font-semibold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {q.userAnswer || '(No answer provided)'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Correct Answer</span>
                          <span className="font-semibold text-slate-900">{q.correctAnswer}</span>
                        </div>
                      </div>

                      {q.explanation && (
                        <div className="bg-white/80 p-3 rounded-lg border border-slate-100 space-y-1">
                          <strong className="text-slate-700 block text-[11px]">Explanation from Document:</strong>
                          <p className="text-slate-600 leading-relaxed">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
