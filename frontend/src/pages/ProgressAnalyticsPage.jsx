import { motion } from 'framer-motion'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  Layers,
  LineChart,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../services/api.js'

export default function ProgressAnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/api/analytics/dashboard')
      .then((res) => {
        if (active) {
          setData(res)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message)
          setLoading(false)
        }
      })
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-3">
        <LoaderCircle className="animate-spin text-indigo-600" size={32} />
        <p className="text-xs font-semibold text-slate-500">Loading KnowFlow Learning Analytics…</p>
      </div>
    )
  }

  const {
    summary = {},
    documentProgress = [],
    topicProgress = [],
    analytics = {},
    recentActivity = [],
  } = data || {}

  const mastery = analytics.topicMasteryDistribution || { strong: 0, improving: 0, weak: 0, unassessed: 0 }
  const totalTracked = mastery.strong + mastery.improving + mastery.weak + mastery.unassessed
  const testScores = analytics.testPerformance || []
  const revisionHistory = analytics.revisionHistory || []

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="text-indigo-600" size={24} /> Learning Progress & Mastery Analytics
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Grounded, non-random progress tracking across your study documents, assessments, and adaptive revision.
            </p>
          </div>
          <Link
            to="/app"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            Dashboard View <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs font-semibold text-rose-700">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Top 4 Multi-Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-indigo-600">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Overall Progress</span>
            <Target size={20} />
          </div>
          <div className="text-3xl font-black text-slate-900">{summary.overallLearningProgress || 0}%</div>
          <small className="text-xs text-slate-500 block">
            {summary.topicsCompleted || 0} of {summary.topicsRemaining + summary.topicsCompleted || 0} topics completed
          </small>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Test Score</span>
            <Trophy size={20} />
          </div>
          <div className="text-3xl font-black text-slate-900">
            {summary.testPerformance?.averageScore !== null ? `${summary.testPerformance.averageScore}%` : '—'}
          </div>
          <small className="text-xs text-slate-500 block">
            Across {summary.testPerformance?.totalTestsAttempted || 0} completed assessments
          </small>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Weak Topics</span>
            <RotateCcw size={20} />
          </div>
          <div className="text-3xl font-black text-rose-600">{summary.weakTopics || 0}</div>
          <small className="text-xs text-slate-500 block">
            {summary.topicsRevised || 0} revised via adaptive retest
          </small>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Library Studied</span>
            <BookOpen size={20} />
          </div>
          <div className="text-3xl font-black text-slate-900">{summary.documentsStudied || 0}</div>
          <small className="text-xs text-slate-500 block">
            of {summary.totalDocuments || 0} uploaded documents
          </small>
        </div>
      </div>

      {/* Breakdown Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Knowledge State Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-slate-900 text-sm">Knowledge Mastery Distribution</h3>
          <p className="text-xs text-slate-500">
            Categorized by actual student test performance and completed study notes.
          </p>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-emerald-700">Strong Topics (&ge; 80%)</span>
                <span>{mastery.strong}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, ((mastery.strong || 0) / Math.max(1, totalTracked)) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-amber-700">Improving (60 - 79%)</span>
                <span>{mastery.improving}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, ((mastery.improving || 0) / Math.max(1, totalTracked)) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-rose-700">Weak Topics (&lt; 60%)</span>
                <span>{mastery.weak}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-rose-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, ((mastery.weak || 0) / Math.max(1, totalTracked)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Assessment Performance */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-slate-900 text-sm">Recent Assessment History</h3>
          <p className="text-xs text-slate-500">
            Chronological scores from topic and document assessments.
          </p>

          {testScores.length > 0 ? (
            <div className="space-y-2.5">
              {testScores.slice(-5).reverse().map((t) => (
                <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-slate-900">{t.documentName}</h4>
                    <span className="text-[10px] text-slate-400">
                      {new Date(t.completedAt).toLocaleDateString()} · {t.correctCount} of {t.totalQuestions} correct
                    </span>
                  </div>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded ${
                      t.scorePercentage >= 80
                        ? 'bg-emerald-100 text-emerald-800'
                        : t.scorePercentage >= 60
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {t.scorePercentage}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500">
              No completed tests yet. Start an assessment from your document library to track scores.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
