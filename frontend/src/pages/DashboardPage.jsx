import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  LineChart,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { apiRequest } from '../services/api.js'

export default function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'Learner'

  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [topicSearch, setTopicSearch] = useState('')
  const [topicFilter, setTopicFilter] = useState('ALL') // ALL, COMPLETED, IN_PROGRESS, WEAK
  const [activeChartTab, setActiveChartTab] = useState('TESTS') // TESTS, MASTERY, ACTIVITY

  async function loadDashboard() {
    try {
      setLoading(true)
      const res = await apiRequest('/api/analytics/dashboard')
      setDashboardData(res)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center space-y-4">
        <LoaderCircle className="animate-spin text-indigo-600" size={36} />
        <p className="text-sm font-semibold text-slate-600">Aggregating Real Learning Analytics across your Library…</p>
      </div>
    )
  }

  const {
    summary = {},
    documentProgress = [],
    topicProgress = [],
    analytics = {},
    recentActivity = [],
    recentDocuments = [],
  } = dashboardData || {}

  const testScores = analytics.testPerformance || []
  const mastery = analytics.topicMasteryDistribution || { strong: 0, improving: 0, weak: 0, unassessed: 0 }
  const weakOverview = analytics.weakTopicsOverview || { counts: {}, activeRecords: [] }
  const revisionHistory = analytics.revisionHistory || []
  const activityTrend = analytics.learningActivityOverTime || []
  const averageTestScore = summary.testPerformance?.averageScore

  // Filtered topics
  const filteredTopics = topicProgress.filter((t) => {
    const matchesSearch = t.topicTitle.toLowerCase().includes(topicSearch.toLowerCase()) ||
      t.documentName.toLowerCase().includes(topicSearch.toLowerCase())
    if (!matchesSearch) return false
    if (topicFilter === 'COMPLETED') return t.status === 'COMPLETED'
    if (topicFilter === 'IN_PROGRESS') return t.status === 'IN_PROGRESS'
    if (topicFilter === 'WEAK') return t.isWeak
    return true
  })

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
      {/* 1. WELCOME & MOTIVATIONAL BANNER */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800"
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles size={13} /> KnowFlow Analytics Engine
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Welcome to your learning flow, {firstName} ✦
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Track your actual mastery across uploaded papers, monitor real test scores, and target weak topics with adaptive micro-learning.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/app/papers"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5"
            >
              <Plus size={15} /> Upload PDFs
            </Link>
            <button
              type="button"
              onClick={loadDashboard}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur transition-colors flex items-center gap-1.5 border border-white/10"
              title="Refresh Real Analytics"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </motion.section>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-rose-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* 2. OVERALL LEARNING METRIC CARDS (12 Core Metrics) */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Total Documents */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Documents</span>
            <FileText size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{summary.totalDocuments || 0}</div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <span className="text-emerald-600 font-semibold">{summary.documentsReady || 0} ready</span> · {summary.documentsProcessing || 0} processing
          </div>
        </div>

        {/* Documents Studied */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Studied</span>
            <BookOpen size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{summary.documentsStudied || 0}</div>
          <div className="text-[11px] text-slate-500">
            of {summary.totalDocuments || 0} papers opened
          </div>
        </div>

        {/* Overall Learning Progress */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Overall Progress</span>
            <Target size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{summary.overallLearningProgress || 0}%</div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, summary.overallLearningProgress || 0)}%` }}
            />
          </div>
        </div>

        {/* Topics Completed */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Topics Done</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{summary.topicsCompleted || 0}</div>
          <div className="text-[11px] text-slate-500">
            {summary.topicsRemaining || 0} remaining
          </div>
        </div>

        {/* Weak Topics */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Weak Topics</span>
            <RotateCcw size={16} className="text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-600">{summary.weakTopics || 0}</div>
          <div className="text-[11px] text-slate-500">
            {summary.topicsRevised || 0} revised & retested
          </div>
        </div>

        {/* Test Performance */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Test Score</span>
            <Trophy size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {averageTestScore == null ? '—' : `${averageTestScore}%`}
          </div>
          <div className="text-[11px] text-slate-500">
            {summary.testPerformance?.totalTestsAttempted
              ? `${summary.testPerformance.totalTestsAttempted} tests · ${summary.testPerformance.passRate}% pass rate`
              : 'No completed tests yet'}
          </div>
        </div>
      </section>

      {/* 3. VISUAL ANALYTICS & CHARTS SECTION */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="text-indigo-600" size={20} /> Learning Analytics & Progress Visualizations
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Empirical assessment metrics, mastery distribution, and daily learning frequency.
            </p>
          </div>

          <div className="flex rounded-xl bg-slate-100 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveChartTab('TESTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeChartTab === 'TESTS'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Test Performance Trend
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('MASTERY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeChartTab === 'MASTERY'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Topic Mastery Distribution
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('ACTIVITY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeChartTab === 'ACTIVITY'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7-Day Activity Trend
            </button>
          </div>
        </div>

        {/* Tab 1: Test Performance Trend Chart */}
        {activeChartTab === 'TESTS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Chronological Assessment Scores ({testScores.length} attempts)</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> &gt;= 80% Strong</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500" /> 60-79% Improving</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500" /> &lt; 60% Weak</span>
              </span>
            </div>

            {testScores.length > 0 ? (
              <div className="w-full bg-slate-50/60 rounded-2xl p-4 border border-slate-100 overflow-x-auto">
                <svg viewBox="0 0 540 160" className="w-full h-44 min-w-[480px]">
                  {/* Grid lines */}
                  <line x1="30" y1="20" x2="520" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <text x="15" y="24" className="text-[10px] fill-slate-400 font-mono">100%</text>
                  <line x1="30" y1="65" x2="520" y2="65" stroke="#e2e8f0" strokeDasharray="3 3" />
                  <text x="15" y="69" className="text-[10px] fill-slate-400 font-mono">60%</text>
                  <line x1="30" y1="125" x2="520" y2="125" stroke="#cbd5e1" strokeWidth="1.5" />
                  <text x="15" y="128" className="text-[10px] fill-slate-400 font-mono">0%</text>

                  {/* Bars & Score Points */}
                  {testScores.map((item, idx) => {
                    const score = Math.max(0, Math.min(100, item.scorePercentage || 0))
                    const barHeight = (score / 100) * 105
                    const barWidth = Math.min(32, Math.max(16, 420 / testScores.length))
                    const x = 50 + idx * ((480 - 50) / Math.max(1, testScores.length))
                    const y = 125 - barHeight
                    const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#f43f5e'
                    const dateStr = item.completedAt ? new Date(item.completedAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) : `#${idx + 1}`

                    return (
                      <g key={item.id} className="transition-all hover:opacity-80 cursor-pointer">
                        <title>{`${item.documentName}: ${score}% (${item.correctCount}/${item.totalQuestions} correct)`}</title>
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          rx="4"
                          fill={color}
                        />
                        <text
                          x={x + barWidth / 2}
                          y={Math.max(14, y - 5)}
                          textAnchor="middle"
                          className="text-[10px] font-bold fill-slate-700"
                        >
                          {score}%
                        </text>
                        <text
                          x={x + barWidth / 2}
                          y={142}
                          textAnchor="middle"
                          className="text-[9px] font-medium fill-slate-400"
                        >
                          {dateStr}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <ClipboardCheck size={28} className="mx-auto text-slate-400" />
                <h4 className="text-xs font-bold text-slate-700">No Assessment Records Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Take a topic or document test to generate real assessment performance trends.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Topic Mastery Distribution */}
        {activeChartTab === 'MASTERY' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-xs font-bold uppercase">Strong Topics</span>
                <Award size={18} />
              </div>
              <div className="text-3xl font-black text-emerald-900">{mastery.strong}</div>
              <p className="text-[11px] text-emerald-700">Demonstrated score &gt;= 80% or completed notes</p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1">
              <div className="flex items-center justify-between text-amber-800">
                <span className="text-xs font-bold uppercase">Improving</span>
                <Activity size={18} />
              </div>
              <div className="text-3xl font-black text-amber-900">{mastery.improving}</div>
              <p className="text-[11px] text-amber-700">Partial mastery (60-79%), recommend quick review</p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-1">
              <div className="flex items-center justify-between text-rose-800">
                <span className="text-xs font-bold uppercase">Weak Topics</span>
                <RotateCcw size={18} />
              </div>
              <div className="text-3xl font-black text-rose-900">{mastery.weak}</div>
              <p className="text-[11px] text-rose-700">Score &lt; 60%, requires adaptive reteach</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-xs font-bold uppercase">Unassessed</span>
                <BookOpen size={18} />
              </div>
              <div className="text-3xl font-black text-slate-800">{mastery.unassessed}</div>
              <p className="text-[11px] text-slate-500">Document topics pending initial study or test</p>
            </div>
          </div>
        )}

        {/* Tab 3: 7-Day Activity Trend */}
        {activeChartTab === 'ACTIVITY' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Daily Student Activity (Last 7 Days)</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-500" /> Reads & Studies</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Tests Taken</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500" /> Revisions</span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 pt-2">
              {activityTrend.map((day, idx) => (
                <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center space-y-2">
                  <div className="text-[11px] font-bold text-slate-500">{day.label}</div>
                  <div className="text-lg font-black text-slate-900">{day.total}</div>
                  <div className="space-y-1 pt-1 border-t border-slate-200/60 text-[10px] text-slate-500 font-medium">
                    <div className="text-indigo-600">{day.reads} studies</div>
                    <div className="text-emerald-600">{day.tests} tests</div>
                    <div className="text-rose-600">{day.revisions} revs</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 4. PER-DOCUMENT LEARNING PROGRESS SECTION */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Layers className="text-indigo-600" size={20} /> Document-by-Document Learning Progress
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Specific completion status, test scores, and weak topics for each uploaded document.
            </p>
          </div>
          <Link
            to="/app/papers"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            Library View <ArrowRight size={14} />
          </Link>
        </div>

        {documentProgress.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documentProgress.map((doc) => (
              <div
                key={doc.documentId}
                className="p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all bg-white hover:shadow-md space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                      <FileText size={18} />
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        doc.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : doc.status === 'IN_PROGRESS'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {doc.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm line-clamp-1" title={doc.documentName}>
                      {doc.documentName}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {doc.topicsCompleted} of {doc.totalTopics} topics completed · {doc.topicsRemaining} remaining
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500">Progress</span>
                      <span className="text-slate-900">{doc.documentLearningProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${doc.documentLearningProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Stat Chips */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Tests</span>
                      <span className="font-extrabold text-slate-800">
                        {doc.testsAttempted} taken {doc.score !== null ? `(${doc.score}%)` : ''}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Weak Topics</span>
                      <span className={`font-extrabold ${doc.weakTopics > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {doc.weakTopics} detected
                      </span>
                    </div>
                  </div>
                </div>

                {/* Document Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Link
                    to={`/app/papers/${encodeURIComponent(doc.documentId)}/learn`}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                  >
                    <BookOpen size={13} /> Learn
                  </Link>
                  <Link
                    to={`/app/papers/${encodeURIComponent(doc.documentId)}/test`}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                  >
                    <ClipboardCheck size={13} /> Test
                  </Link>
                  <Link
                    to={`/app/papers/${encodeURIComponent(doc.documentId)}/adaptive`}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                  >
                    <RotateCcw size={13} /> Revise
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <FileText size={32} className="mx-auto text-slate-400" />
            <h4 className="text-sm font-bold text-slate-800">Your Document Library is Empty</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Upload your study documents, textbook chapters, or research papers to begin tracking progress.
            </p>
            <Link to="/app/papers" className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs">
              Upload First Paper
            </Link>
          </div>
        )}
      </section>

      {/* 5. TOPIC-BY-TOPIC LEARNING MASTERY TRACKER */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <GraduationCap className="text-indigo-600" size={20} /> Topic-by-Topic Learning Mastery Tracker
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Transparent topic progress tracked using actual recorded activity, tests, and completion criteria.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search topics…"
                value={topicSearch}
                onChange={(e) => setTopicSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 w-44"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex rounded-xl bg-slate-100 p-0.5 text-[11px] font-bold">
              {['ALL', 'COMPLETED', 'IN_PROGRESS', 'WEAK'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTopicFilter(f)}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    topicFilter === f ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredTopics.length > 0 ? (
          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Topic & Document</th>
                  <th className="py-3 px-4">Completion Status & Criteria</th>
                  <th className="py-3 px-4">Test Performance</th>
                  <th className="py-3 px-4">Weak Topic Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTopics.map((topic, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{topic.topicTitle}</div>
                      <div className="text-[10px] text-slate-400">{topic.documentName} · {topic.chapterTitle}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            topic.status === 'COMPLETED'
                              ? 'bg-emerald-500'
                              : topic.status === 'IN_PROGRESS'
                              ? 'bg-indigo-500'
                              : 'bg-slate-300'
                          }`}
                        />
                        <span className="font-semibold text-slate-800">{topic.status.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{topic.completionCriteria}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          topic.testPerformance.includes('%') && parseFloat(topic.testPerformance) >= 80
                            ? 'bg-emerald-50 text-emerald-700'
                            : topic.testPerformance.includes('%') && parseFloat(topic.testPerformance) >= 60
                            ? 'bg-amber-50 text-amber-700'
                            : topic.testPerformance.includes('%')
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {topic.testPerformance}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {topic.isWeak ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          Needs Revision
                        </span>
                      ) : topic.revisionStatus === 'RESOLVED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Resolved (+{topic.improvementDelta}%)
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Normal</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/app/papers/${encodeURIComponent(topic.documentId)}/learn?topicId=${encodeURIComponent(topic.topicId)}`}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] transition-colors"
                        >
                          Learn
                        </Link>
                        <Link
                          to={`/app/papers/${encodeURIComponent(topic.documentId)}/test?topicId=${encodeURIComponent(topic.topicId)}`}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] transition-colors"
                        >
                          Test
                        </Link>
                        {topic.isWeak && (
                          <Link
                            to={`/app/papers/${encodeURIComponent(topic.documentId)}/adaptive`}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] transition-colors"
                          >
                            Revise
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-500 text-xs">
            No topics match your current search or filter.
          </div>
        )}
      </section>

      {/* 6. REVISION ACTIVITY LOG & RECENT LEARNING TIMELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revision Activity Log */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <RotateCcw className="text-rose-600" size={17} /> Adaptive Revision & Retest Activity
            </h3>
            <span className="text-xs text-slate-400 font-medium">{revisionHistory.length} retests</span>
          </div>

          {revisionHistory.length > 0 ? (
            <div className="space-y-3">
              {revisionHistory.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <h4 className="font-bold text-slate-900">{rev.topicName}</h4>
                    <span className="text-[10px] text-slate-400">
                      {rev.documentName} · {new Date(rev.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-800">
                      {rev.previousScore}% $\rightarrow$ <span className="text-emerald-600">{rev.retestScore}%</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      +{rev.improvementDelta}% improvement
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500">
              No adaptive revision sessions yet. When you take a retest on weak topics, improvement results will appear here.
            </div>
          )}
        </section>

        {/* Recent Learning Activity Feed */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Clock className="text-indigo-600" size={17} /> Recent Learning Activity
            </h3>
            <span className="text-xs text-slate-400 font-medium">Actual activity log</span>
          </div>

          {recentActivity.length > 0 ? (
            <div className="space-y-2.5">
              {recentActivity.slice(0, 6).map((act, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        act.eventType === 'TEST_COMPLETED'
                          ? 'bg-emerald-500'
                          : act.eventType === 'RETEST_COMPLETED'
                          ? 'bg-purple-500'
                          : act.eventType === 'TOPIC_COMPLETED'
                          ? 'bg-blue-500'
                          : 'bg-indigo-500'
                      }`}
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">{act.title}</span>
                      {act.documentName && (
                        <span className="text-[10px] text-slate-400">{act.documentName}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                    {new Date(act.createdAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500">
              No recent activity recorded yet.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
