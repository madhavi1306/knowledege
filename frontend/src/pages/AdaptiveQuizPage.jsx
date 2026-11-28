import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Layers,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'

export default function AdaptiveQuizPage() {
  const [searchParams] = useSearchParams()
  const conceptId = searchParams.get('conceptId')

  // Document & topic selector state
  const [documents, setDocuments] = useState([])
  const [selectedDocId, setSelectedDocId] = useState('')
  const [docTopics, setDocTopics] = useState([])
  const [selectedChapter, setSelectedChapter] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState('')

  // Quiz config
  const [mode, setMode] = useState('COMPREHENSIVE') // 'COMPREHENSIVE', 'WEAK_ONLY', 'QUICK'
  const [questionCount, setQuestionCount] = useState(5)
  const [difficulty, setDifficulty] = useState('MEDIUM')

  // Active quiz state
  const [session, setSession] = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userAnswers, setUserAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  // 1. Load User Documents on mount
  useEffect(() => {
    apiRequest('/api/documents')
      .then((res) => {
        const docs = res.items || []
        setDocuments(docs)
        if (docs.length > 0) {
          setSelectedDocId(docs[0].id)
          loadDocumentTopics(docs[0].id)
        }
      })
      .catch((err) => setError(err.message))
  }, [])

  // 2. Load Topics when document changes
  async function loadDocumentTopics(docId) {
    if (!docId) return
    try {
      const res = await apiRequest(`/api/learning/${encodeURIComponent(docId)}`).catch(() => ({ topics: [] }))
      setDocTopics(res.topics || [])
      setSelectedChapter('')
      setSelectedTopicId('')
    } catch {
      setDocTopics([])
    }
  }

  function handleDocChange(e) {
    const docId = e.target.value
    setSelectedDocId(docId)
    loadDocumentTopics(docId)
  }

  // Extract unique chapters
  const availableChapters = Array.from(
    new Set(docTopics.map((t) => t.chapterTitle).filter((ch) => ch && ch !== 'Chapter Material')),
  )

  const filteredTopics = selectedChapter
    ? docTopics.filter((t) => t.chapterTitle === selectedChapter)
    : docTopics

  // 3. Start Test / Quiz
  async function startQuiz() {
    setLoading(true)
    setError('')
    setResult(null)
    setUserAnswers({})
    setCurrentIdx(0)

    try {
      // If a specific document is chosen, prefer using the grounded Phase 7 Assessment Engine
      if (selectedDocId) {
        const scope = selectedTopicId ? 'TOPIC' : selectedChapter ? 'CHAPTER' : 'DOCUMENT'
        const payload = {
          scope,
          topicId: selectedTopicId || null,
          chapterTitle: selectedChapter || null,
          difficulty,
          questionCount: Number(questionCount),
        }

        const res = await apiRequest(`/api/assessments/${encodeURIComponent(selectedDocId)}/generate`, {
          method: 'POST',
          body: payload,
        })

        // Standardize session shape
        const sess = res.session || res.assessment || res
        const rawQuestions = sess.questions || []
        const formattedQuestions = rawQuestions.map((q) => ({
          id: q.id,
          questionText: q.prompt || q.questionText || q.question,
          type: q.type || 'MULTIPLE_CHOICE',
          difficulty: q.difficulty || difficulty,
          options: q.options || ['True', 'False'],
          conceptName: q.topicName || q.conceptName || 'Core Concept',
          chapterTitle: q.chapterTitle || sess.chapterTitle || null,
        }))

        setSession({
          id: sess.id,
          mode: `${difficulty} ${payload.scope}`,
          documentId: selectedDocId,
          isAssessmentEngine: true,
          questions: formattedQuestions,
        })
        return
      }

      // Otherwise, use the adaptive quiz engine
      const res = await apiRequest('/api/quizzes/start', {
        method: 'POST',
        body: {
          mode,
          questionCount: Number(questionCount),
          targetConceptIds: conceptId ? [conceptId] : [],
        },
      })
      setSession(res.session)
    } catch (err) {
      setError(err.message || 'Failed to generate test questions.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-start if conceptId passed
  useEffect(() => {
    if (conceptId) {
      startQuiz()
    }
  }, [conceptId])

  // 4. Submit Quiz for Grading
  async function submitQuiz() {
    if (!session) return
    setSubmitting(true)
    setError('')

    try {
      if (session.isAssessmentEngine && session.documentId) {
        const res = await apiRequest(`/api/assessments/sessions/${encodeURIComponent(session.id)}/submit`, {
          method: 'POST',
          body: { answers: userAnswers },
        })
        const evaluation = res.session || res.evaluation || res
        setResult({
          scorePercentage: evaluation.scorePercentage ?? Math.round(((evaluation.score || 0) / (session.questions.length || 1)) * 100),
          questions: evaluation.questions || session.questions,
          evaluationSummary: {
            recommendation:
              (evaluation.scorePercentage || 0) >= 70
                ? 'Great mastery! You have a solid grasp of this material.'
                : 'Revision recommended. Review the weak concepts flagged below.',
            weakConcepts: evaluation.weakTopics || [],
          },
        })
      } else {
        const res = await apiRequest(`/api/quizzes/${encodeURIComponent(session.id)}/submit`, {
          method: 'POST',
          body: { answers: userAnswers },
        })
        setResult(res.session)
      }
    } catch (err) {
      setError(err.message || 'Error submitting test answers.')
    } finally {
      setSubmitting(false)
    }
  }

  const currentQ = session?.questions?.[currentIdx]
  const isLastQuestion = session ? currentIdx === session.questions.length - 1 : false
  const answeredCount = Object.keys(userAnswers).length

  return (
    <div className="adaptive-quiz-page p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
            <ClipboardCheck size={14} /> KNOWFLOW Assessment Engine
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Tests & Adaptive Quizzes
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Diagnostic tests grounded in your actual uploaded documents, chapters, and topics.
          </p>
        </div>

        {selectedDocId && (
          <Link
            to={`/app/papers/${encodeURIComponent(selectedDocId)}/test`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
          >
            <BookOpen size={13} /> Dedicated Document Test View
          </Link>
        )}
      </header>

      {/* 1. Setup Screen (when no active test) */}
      {!session && !result && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Zap size={18} className="text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Configure Your Test
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Choose Document */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Notes / Paper
              </label>
              {documents.length > 0 ? (
                <div className="relative">
                  <select
                    value={selectedDocId}
                    onChange={handleDocChange}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                  >
                    {documents.map((doc) => {
                      const cleanLabel = doc.fileName
                        .replace(/\.pdf$/i, '')
                        .replace(/[_-]/g, ' ')
                      return (
                        <option key={doc.id} value={doc.id}>
                          {cleanLabel} ({doc.fileName})
                        </option>
                      )
                    })}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  No documents found. <Link to="/app/papers" className="underline font-bold">Upload a PDF</Link> to start taking tests.
                </div>
              )}
            </div>

            {/* Choose Chapter */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Chapter Scope
              </label>
              <div className="relative">
                <select
                  value={selectedChapter}
                  onChange={(e) => {
                    setSelectedChapter(e.target.value)
                    setSelectedTopicId('')
                  }}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                >
                  <option value="">All Chapters (Full Subject Test)</option>
                  {availableChapters.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Choose Topic (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Topic Scope (Optional)
              </label>
              <div className="relative">
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                >
                  <option value="">All Topics in {selectedChapter ? 'this Chapter' : 'Document'}</option>
                  {filteredTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.topicTitle}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Difficulty Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['EASY', 'MEDIUM', 'HARD'].map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      difficulty === diff
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Number of Questions
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[3, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuestionCount(num)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      questionCount === num
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {num} Questions
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              className="button button-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-sm"
              onClick={startQuiz}
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle className="spin" size={17} /> Generating Grounded Questions…
                </>
              ) : (
                <>
                  <Zap size={16} /> Start Assessment Test
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 2. Active Test Interface */}
      {session && !result && currentQ && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Progress Bar & Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">
                Question {currentIdx + 1} of {session.questions.length}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                {currentQ.type?.replace('_', ' ')}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                {currentQ.difficulty}
              </span>
            </div>

            <span className="text-[11px] font-semibold text-slate-500">
              {answeredCount} of {session.questions.length} answered
            </span>
          </div>

          <div className="w-full bg-slate-100 h-1">
            <div
              className="bg-indigo-600 h-1 transition-all duration-300"
              style={{ width: `${((currentIdx + 1) / session.questions.length) * 100}%` }}
            />
          </div>

          {/* Question Body */}
          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {currentQ.chapterTitle && (
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <BookOpen size={12} /> {currentQ.chapterTitle}
                  </span>
                )}
                <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Layers size={12} /> {currentQ.conceptName}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-relaxed">
                {currentQ.questionText}
              </h2>
            </div>

            {/* Answer Options */}
            <div className="space-y-2.5">
              {currentQ.options && currentQ.options.length > 0 ? (
                currentQ.options.map((opt, optIdx) => {
                  const isSelected = userAnswers[currentQ.id] === opt
                  return (
                    <label
                      key={optIdx}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-900 shadow-xs ring-1 ring-indigo-500'
                          : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name={currentQ.id}
                        value={opt}
                        checked={isSelected}
                        onChange={() => setUserAnswers((prev) => ({ ...prev, [currentQ.id]: opt }))}
                        className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <span className="leading-snug">{opt}</span>
                    </label>
                  )
                })
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Type your answer here…"
                    value={userAnswers[currentQ.id] || ''}
                    onChange={(e) => setUserAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }))}
                    className="w-full text-xs font-semibold p-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertCircle size={15} /> {error}
              </div>
            )}

            {/* Navigation & Submit Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> Previous
              </button>

              <div className="flex items-center gap-2">
                {!isLastQuestion ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIdx((i) => Math.min(session.questions.length - 1, i + 1))}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    Next <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitQuiz}
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle className="spin" size={15} /> Grading…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} /> Submit Test for Evaluation
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Results Evaluation Screen */}
      {result && (
        <motion.div
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Hero Score Badge */}
          <div className="text-center py-6 border-b border-slate-100 space-y-2">
            <Trophy size={44} className="mx-auto text-amber-500 mb-1" />
            <h2 className="text-xl font-black text-slate-900">Assessment Evaluation</h2>
            <div className="text-4xl font-black text-indigo-600 tracking-tight">
              {result.scorePercentage}%
            </div>
            <p className="text-xs font-medium text-slate-600 max-w-md mx-auto">
              {result.evaluationSummary?.recommendation || 'Assessment completed successfully.'}
            </p>
          </div>

          {/* Question Breakdown */}
          {result.questions && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Question Review & Citations
              </h3>
              <div className="space-y-3">
                {result.questions.map((q, idx) => {
                  const isCorrect = q.isCorrect !== undefined ? q.isCorrect : userAnswers[q.id] === q.correctAnswer
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border text-xs space-y-2 ${
                        isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-800">
                          {idx + 1}. {q.prompt || q.questionText}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isCorrect ? 'Correct' : 'Needs Review'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>
                          <strong className="text-slate-500">Your Answer: </strong>
                          <span className={isCorrect ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                            {userAnswers[q.id] || '(No answer provided)'}
                          </span>
                        </div>
                        {q.correctAnswer && (
                          <div>
                            <strong className="text-slate-500">Correct Answer: </strong>
                            <span className="text-emerald-700 font-semibold">{q.correctAnswer}</span>
                          </div>
                        )}
                      </div>

                      {q.explanation && (
                        <p className="text-slate-600 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                          💡 {q.explanation}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              className="button button-primary text-xs font-bold flex items-center gap-1.5"
              onClick={() => {
                setSession(null)
                setResult(null)
              }}
            >
              <RotateCcw size={14} /> Take Another Test
            </button>

            {selectedDocId && (
              <Link
                to={`/app/papers/${encodeURIComponent(selectedDocId)}/adaptive`}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5"
              >
                <Zap size={14} /> Revise Weak Topics
              </Link>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}
