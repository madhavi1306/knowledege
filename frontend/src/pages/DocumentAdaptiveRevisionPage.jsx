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
  FileText,
  HelpCircle,
  History,
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
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import MermaidDiagram from '../components/MermaidDiagram.jsx'
import { apiRequest } from '../services/api.js'

export default function DocumentAdaptiveRevisionPage() {
  const { documentId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [document, setDocument] = useState(null)
  const [weakTopics, setWeakTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Active Revision state
  const [activeRecord, setActiveRecord] = useState(null)
  const [reteachData, setReteachData] = useState(null)
  const [reteachLoading, setReteachLoading] = useState(false)

  // Interactive Practice State
  const [practiceAnswers, setPracticeAnswers] = useState({})
  const [practiceRevealed, setPracticeRevealed] = useState({})

  // Retest state
  const [retestSession, setRetestSession] = useState(null)
  const [retestAnswers, setRetestAnswers] = useState({})
  const [retestSubmitting, setRetestSubmitting] = useState(false)
  const [retestResults, setRetestResults] = useState(null)

  // 1. Load weak topics
  async function loadWeakTopics(targetTopicName = null) {
    try {
      setLoading(true)
      const [docRes, weakRes] = await Promise.all([
        apiRequest(`/api/documents/${encodeURIComponent(documentId)}`),
        apiRequest(`/api/adaptive/${encodeURIComponent(documentId)}/weak-topics`),
      ])

      setDocument(docRes.document)
      const list = weakRes.weakTopics || []
      setWeakTopics(list)

      const target = targetTopicName || searchParams.get('topic')
      if (target && list.length > 0) {
        const found = list.find((w) => w.topicName.toLowerCase() === target.toLowerCase())
        if (found) {
          selectWeakTopic(found)
        }
      } else if (list.length > 0 && !activeRecord) {
        selectWeakTopic(list[0])
      }
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to load weak topics.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Select weak topic & load adaptive reteach
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

  // 3. Launch Retest
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

  // 4. Submit Retest
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
      // Refresh list to update status in sidebar
      loadWeakTopics(activeRecord.topicName)
    } catch (err) {
      setError(err.message || 'Failed to submit retest.')
    } finally {
      setRetestSubmitting(false)
    }
  }

  useEffect(() => {
    loadWeakTopics()
  }, [documentId])

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
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                <Target size={13} /> Phase 8 Weak Topic Detection & Adaptive Reteach
              </span>
              <h1 className="text-base font-bold text-slate-900 line-clamp-1">
                {document?.fileName || 'Adaptive Learning Workspace'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/app/papers/${encodeURIComponent(documentId)}/test`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors"
            >
              <ClipboardCheck size={14} /> Full Assessments
            </Link>
            <Link
              to={`/app/papers/${encodeURIComponent(documentId)}/learn`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors"
            >
              <BookOpen size={14} /> Structured Notes
            </Link>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto w-full flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Weak Topics Diagnostics List */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Target size={16} className="text-rose-600" />
                Detected Weak Topics ({weakTopics.length})
              </h2>
              <button
                type="button"
                onClick={() => loadWeakTopics(activeRecord?.topicName)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
                title="Re-analyze test results"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Identified from actual test errors and scores below 70%. Never classified randomly.
            </p>
          </div>

          {/* Weak Topics List */}
          <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <LoaderCircle className="animate-spin text-rose-600" size={24} />
                <span className="text-xs">Analyzing error patterns…</span>
              </div>
            ) : weakTopics.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
                <h4 className="font-bold text-slate-800">No Weak Topics Detected!</h4>
                <p className="text-[11px] text-slate-500">
                  You have answered questions with high mastery, or have not taken an assessment yet.
                </p>
                <Link
                  to={`/app/papers/${encodeURIComponent(documentId)}/test`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-xl shadow-xs mt-2"
                >
                  <ClipboardCheck size={14} /> Take a Test First
                </Link>
              </div>
            ) : (
              weakTopics.map((item) => {
                const isActive = activeRecord?.id === item.id
                const isResolved = item.status === 'RESOLVED'
                const isRepeated = item.status === 'REPEATED_DIFFICULTY'

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectWeakTopic(item)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-2 ${
                      isActive
                        ? 'bg-white border-rose-500 shadow-md ring-2 ring-rose-500/20'
                        : isResolved
                        ? 'bg-emerald-50/20 border-emerald-200 hover:border-emerald-300'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isResolved
                            ? 'bg-emerald-100 text-emerald-800'
                            : isRepeated
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700">
                        Score: {item.currentScore}%
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-slate-800 line-clamp-2">
                      {item.topicName}
                    </h3>

                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {item.detectionReason}
                    </p>

                    {item.improvementDelta > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <Sparkles size={11} /> +{item.improvementDelta}% improvement
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Right Column: Adaptive Revision & Retest Workspace */}
        <main className="lg:col-span-8 flex flex-col gap-6">
          {!activeRecord ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-500 space-y-2">
              <Target size={40} className="mx-auto text-slate-300" />
              <h3 className="text-base font-bold text-slate-800">Select a Weak Topic to Revise</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Choose any flagged topic on the left to review its gap analysis, micro-steps, and new analogies.
              </p>
            </div>
          ) : reteachLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <LoaderCircle className="animate-spin text-rose-600" size={32} />
              <p className="text-sm font-medium text-slate-600">Generating adaptive reteach with new analogies…</p>
            </div>
          ) : !retestSession && !retestResults ? (
            /* ========================================================
               1. ADAPTIVE RETEACH WORKSPACE (Alternative explanations)
               ======================================================== */
            <div className="space-y-6">
              {/* Topic Header & Diagnostic Reason */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                      Adaptive Revision • Document Page {reteachData?.pageNumber || 1}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">{activeRecord.topicName}</h2>
                  </div>

                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    Previous Score: {activeRecord.currentScore}%
                  </span>
                </div>

                {/* Gap Analysis Card */}
                <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl space-y-1 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                    <AlertCircle size={13} /> Why this topic was flagged
                  </span>
                  <p className="text-rose-950 font-semibold leading-relaxed">
                    {activeRecord.detectionReason}
                  </p>
                  {reteachData?.gapAnalysis && (
                    <p className="text-rose-800 pt-1 leading-relaxed border-t border-rose-200/60">
                      {reteachData.gapAnalysis}
                    </p>
                  )}
                </div>

                {/* 1. Everyday Words Explanation */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Lightbulb size={15} className="text-amber-500" />
                    1. Re-explained in Simpler Everyday Words
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed bg-amber-50/40 p-4 rounded-xl border border-amber-100 font-medium">
                    {reteachData?.simplifiedExplanation}
                  </p>
                </div>

                {/* 2. Micro Step-by-Step Breakdown */}
                {reteachData?.microSteps?.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <ListOrdered size={15} className="text-indigo-600" />
                      2. Step-by-Step Micro Mechanics
                    </h3>
                    <div className="space-y-2">
                      {reteachData.microSteps.map((st, sIdx) => (
                        <div key={sIdx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-2.5 text-xs">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                            {st.step}
                          </span>
                          <div>
                            <strong className="text-slate-900 block">{st.title}</strong>
                            <p className="text-slate-600 mt-0.5 leading-relaxed">{st.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Fresh Alternative Analogy */}
                {reteachData?.differentAnalogy && (
                  <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                      <Sparkles size={13} className="text-indigo-600" />
                      3. Fresh Real-World Analogy (New Perspective)
                    </span>
                    <strong className="text-indigo-950 block">{reteachData.differentAnalogy.title}</strong>
                    <p className="text-indigo-900 leading-relaxed">{reteachData.differentAnalogy.description}</p>
                  </div>
                )}

                {/* 4. Simplified Conceptual Diagram */}
                {reteachData?.simplifiedDiagram && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Layers size={15} className="text-cyan-600" />
                      4. Simplified Visual Flowchart
                    </h3>
                    <MermaidDiagram chart={reteachData.simplifiedDiagram} id={activeRecord.id} />
                  </div>
                )}

                {/* 5. Targeted Practice Questions (Mini-Check) */}
                {reteachData?.practiceQuestions?.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <HelpCircle size={15} className="text-emerald-600" />
                      5. Quick Interactive Practice Check
                    </h3>
                    <div className="space-y-3">
                      {reteachData.practiceQuestions.map((pq, pIdx) => {
                        const selectedAns = practiceAnswers[pq.id]
                        const isRevealed = practiceRevealed[pq.id]

                        return (
                          <div key={pq.id || pIdx} className="p-3.5 rounded-xl border border-slate-200 bg-white text-xs space-y-2.5">
                            <p className="font-semibold text-slate-800">{pq.question}</p>
                            <div className="flex flex-wrap gap-2">
                              {pq.options.map((opt, oIdx) => {
                                const isSelected = selectedAns === opt
                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    onClick={() => {
                                      setPracticeAnswers((prev) => ({ ...prev, [pq.id]: opt }))
                                      setPracticeRevealed((prev) => ({ ...prev, [pq.id]: true }))
                                    }}
                                    className={`px-3 py-1.5 rounded-lg border text-left transition-all ${
                                      isSelected
                                        ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                )
                              })}
                            </div>
                            {isRevealed && (
                              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 space-y-0.5">
                                <span className="font-bold text-[10px] text-emerald-800 block">Explanation:</span>
                                <p className="text-[11px]">{pq.explanation}</p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Retest Trigger Button */}
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={handleStartRetest}
                    className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
                  >
                    <ClipboardCheck size={16} /> Take Retest to Prove Mastery <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : !retestResults ? (
            /* ========================================================
               2. ACTIVE RETEST MODE (Answering new questions)
               ======================================================== */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                    Mastery Retest • {activeRecord.topicName}
                  </span>
                  <h2 className="text-base font-bold text-slate-900">
                    Answer Retest Questions ({retestSession.retestQuestions.length} Qs)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setRetestSession(null)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Back to Reteach
                </button>
              </div>

              <div className="space-y-4">
                {retestSession.retestQuestions.map((q, idx) => {
                  const currentAns = retestAnswers[q.id] || ''
                  return (
                    <div key={q.id || idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">Question {idx + 1}</span>
                        <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                          Page {q.pageNumber}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800">{q.questionText}</p>

                      {q.options?.length > 0 ? (
                        <div className="space-y-2">
                          {q.options.map((opt, oIdx) => {
                            const isSelected = currentAns === opt
                            return (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => setRetestAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                className={`w-full text-left p-3 rounded-lg border transition-all ${
                                  isSelected
                                    ? 'bg-rose-50 border-rose-600 text-rose-950 font-semibold'
                                    : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                                }`}
                              >
                                {opt}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={currentAns}
                          onChange={(e) => setRetestAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="Type your answer…"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-rose-500"
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmitRetest}
                  disabled={retestSubmitting}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {retestSubmitting ? <LoaderCircle className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  Submit Retest
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================
               3. RETEST RESULTS & IMPROVEMENT COMPARISON
               ======================================================== */
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
                <div
                  className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
                    retestResults.status === 'RESOLVED'
                      ? 'bg-emerald-50 text-emerald-600'
                      : retestResults.status === 'IMPROVING'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-purple-50 text-purple-600'
                  }`}
                >
                  {retestResults.status === 'RESOLVED' ? <Trophy size={32} /> : <Award size={32} />}
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Retest Result: {retestResults.status.replace(/_/g, ' ')}
                  </span>
                  <h2 className="text-3xl font-extrabold text-slate-900">
                    {retestResults.retestScore}%
                  </h2>
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    Previous Score: {retestResults.previousScore}% •{' '}
                    <span className={retestResults.improvementDelta >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600'}>
                      {retestResults.improvementDelta >= 0 ? `+${retestResults.improvementDelta}% Improvement!` : `${retestResults.improvementDelta}%`}
                    </span>
                  </p>
                </div>

                <div className="pt-2 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRetestSession(null)
                      setRetestResults(null)
                    }}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    Back to Revision
                  </button>
                  <Link
                    to={`/app/papers/${encodeURIComponent(documentId)}/learn`}
                    className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Return to Notes
                  </Link>
                </div>
              </div>

              {/* Review Retest Questions */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Retest Answer Review
                </h3>
                <div className="space-y-3">
                  {retestSession.retestQuestions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        q.isCorrect ? 'bg-emerald-50/20 border-emerald-200' : 'bg-rose-50/20 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          {q.isCorrect ? (
                            <CheckCircle2 size={15} className="text-emerald-600" />
                          ) : (
                            <XCircle size={15} className="text-rose-600" />
                          )}
                          Question {idx + 1}
                        </span>
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-semibold">
                          Page {q.pageNumber}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800">{q.questionText}</p>
                      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                        <div>
                          <span className="text-slate-400 block font-bold">Your Answer:</span>
                          <span className={q.isCorrect ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                            {q.userAnswer || '(Empty)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-bold">Correct Answer:</span>
                          <span className="text-slate-900 font-bold">{q.correctAnswer}</span>
                        </div>
                      </div>
                      {q.explanation && (
                        <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
