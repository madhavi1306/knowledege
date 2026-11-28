import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  FileText,
  Flame,
  Globe,
  HelpCircle,
  Layers,
  Lightbulb,
  Milestone,
  Network,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import {
  SUPPORTED_LANGUAGES,
  getConceptTranslation,
  speakInLanguage,
  t,
} from '../services/i18n.js'

const LEVEL_CONFIG = {
  1: {
    title: 'Level 1: Basic & Foundational',
    subtitle: 'Zero prior knowledge required. Build intuitive mental models, simple definitions, and everyday analogies.',
    badge: 'Beginner / Foundation',
    color: 'from-emerald-500/10 to-teal-500/5 border-emerald-300 text-emerald-800',
    iconColor: 'bg-emerald-100 text-emerald-700',
  },
  2: {
    title: 'Level 2: Intermediate & Core Mechanics',
    subtitle: 'Operational procedures, formal rules, matrix & digraph representations, and step-by-step mechanisms.',
    badge: 'Intermediate / Applied',
    color: 'from-sky-500/10 to-indigo-500/5 border-sky-300 text-sky-800',
    iconColor: 'bg-sky-100 text-sky-700',
  },
  3: {
    title: 'Level 3: Advanced & Exam Mastery',
    subtitle: 'Complex proofs, Hasse diagrams, Warshall algorithms, edge cases, and exam-level problem solving.',
    badge: 'Advanced / Mastery',
    color: 'from-purple-500/10 to-pink-500/5 border-purple-300 text-purple-800',
    iconColor: 'bg-purple-100 text-purple-700',
  },
}

export default function PersonalizedLearningPathPage() {
  const [searchParams] = useSearchParams()
  const [documents, setDocuments] = useState([])
  const [selectedDocId, setSelectedDocId] = useState(searchParams.get('documentId') || '')
  const [language, setLanguage] = useState('en')
  const [concepts, setConcepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeLevel, setActiveLevel] = useState('ALL') // 'ALL' | '1' | '2' | '3'
  const [speakingId, setSpeakingId] = useState(null)

  // 1. Load available documents
  useEffect(() => {
    apiRequest('/api/documents')
      .then((res) => setDocuments(res.items || []))
      .catch(() => setDocuments([]))
  }, [])

  // 2. Load and structure concepts into Basic to Advanced progression
  async function loadPath() {
    setLoading(true)
    setError('')
    try {
      const url = selectedDocId
        ? `/api/learning/graph?documentId=${encodeURIComponent(selectedDocId)}`
        : '/api/learning/graph'
      const res = await apiRequest(url)
      const nodes = res.nodes || []

      // Distribute nodes progressively into Level 1 (Basic), Level 2 (Intermediate), Level 3 (Advanced)
      const categorized = nodes.map((node, idx) => {
        const total = nodes.length
        let level = 1
        if (node.difficulty === 'HARD' || idx >= Math.floor((total * 2) / 3)) {
          level = 3
        } else if (node.difficulty === 'MEDIUM' || idx >= Math.floor(total / 3)) {
          level = 2
        } else {
          level = 1
        }
        return { ...node, level, stepNumber: idx + 1 }
      })

      setConcepts(categorized)
    } catch (err) {
      setError(err.message || 'Failed to generate learning path.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPath()
  }, [selectedDocId])

  // 3. Audio pronunciation / explanation in selected language
  function handleSpeak(concept) {
    if (speakingId === concept.id) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      setSpeakingId(null)
      return
    }

    const textToSpeak = getConceptTranslation(
      concept.name,
      concept.simpleExplanation || concept.definition,
      language
    )

    speakInLanguage(
      `${concept.name}. ${textToSpeak}`,
      language,
      () => setSpeakingId(concept.id),
      () => setSpeakingId(null)
    )
  }

  const filteredConcepts = activeLevel === 'ALL'
    ? concepts
    : concepts.filter((c) => String(c.level) === activeLevel)

  const level1Count = concepts.filter((c) => c.level === 1).length
  const level2Count = concepts.filter((c) => c.level === 2).length
  const level3Count = concepts.filter((c) => c.level === 3).length
  const masteredCount = concepts.filter((c) => c.status === 'MASTERED').length
  const overallMastery = concepts.length > 0
    ? Math.round(concepts.reduce((acc, c) => acc + (c.masteryScore || 0), 0) / concepts.length)
    : 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5 mb-1">
            <Milestone size={15} className="text-indigo-500" />
            Adaptive Curriculum Roadmap
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('Basic to Advanced Learning Journey', language)}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            A structured step-by-step progression: start with simple intuition, master operational mechanisms, and advance to exam-level problem solving.
          </p>
        </div>

        {/* Global Controls: Language & Document Filters */}
        <div className="flex flex-wrap items-center gap-3">
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

          {/* Document Filter */}
          <div className="relative min-w-[200px]">
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs truncate"
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

          <button
            type="button"
            onClick={loadPath}
            className="p-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition-colors"
            title="Refresh roadmap"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Progress & Milestone Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Overall Mastery</span>
            <span className="text-base font-extrabold text-slate-900">{overallMastery}%</span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <span className="text-xs font-extrabold">L1</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Basic Concepts</span>
            <span className="text-base font-extrabold text-emerald-700">{level1Count}</span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
            <span className="text-xs font-extrabold">L2</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Intermediate</span>
            <span className="text-base font-extrabold text-sky-700">{level2Count}</span>
          </div>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
            <span className="text-xs font-extrabold">L3</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Advanced</span>
            <span className="text-base font-extrabold text-purple-700">{level3Count}</span>
          </div>
        </div>
      </div>

      {/* Level Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          type="button"
          onClick={() => setActiveLevel('ALL')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
            activeLevel === 'ALL'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          All Stages ({concepts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveLevel('1')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
            activeLevel === '1'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🟢 Level 1: Basic ({level1Count})
        </button>
        <button
          type="button"
          onClick={() => setActiveLevel('2')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
            activeLevel === '2'
              ? 'border-sky-600 text-sky-700 bg-sky-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🟡 Level 2: Intermediate ({level2Count})
        </button>
        <button
          type="button"
          onClick={() => setActiveLevel('3')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
            activeLevel === '3'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          🔴 Level 3: Advanced ({level3Count})
        </button>
      </div>

      {/* Main Stepper Roadmap */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <RefreshCw className="animate-spin text-indigo-600 mx-auto" size={32} />
          <h4 className="text-sm font-bold text-slate-800">Generating Step-by-Step Learning Journey…</h4>
          <p className="text-xs text-slate-500">Sequencing prerequisite hierarchies from basic intuition to advanced theorems.</p>
        </div>
      ) : filteredConcepts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <Compass className="text-slate-400 mx-auto" size={36} />
          <h4 className="text-sm font-bold text-slate-800">No Concepts Ingested Yet</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Upload notes, research papers, or paste a video URL to generate your progressive learning journey.
          </p>
          <Link
            to="/app/papers"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            Go to Uploads <ArrowRight size={13} />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group concepts by level if viewing ALL, or show single level */}
          {[1, 2, 3]
            .filter((lvl) => activeLevel === 'ALL' || String(lvl) === activeLevel)
            .map((lvl) => {
              const levelConcepts = filteredConcepts.filter((c) => c.level === lvl)
              if (levelConcepts.length === 0) return null
              const config = LEVEL_CONFIG[lvl]

              return (
                <div key={lvl} className="space-y-4">
                  {/* Level Banner */}
                  <div className={`p-4 rounded-2xl border bg-gradient-to-r ${config.color} flex flex-wrap items-center justify-between gap-3`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${config.iconColor}`}>
                        L{lvl}
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">{config.title}</h3>
                        <p className="text-[11px] text-slate-600">{config.subtitle}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/80 border border-slate-200/60 shadow-2xs">
                      {levelConcepts.length} Steps
                    </span>
                  </div>

                  {/* Step Cards List */}
                  <div className="space-y-3 pl-4 border-l-2 border-slate-200">
                    {levelConcepts.map((concept, idx) => {
                      const translatedMeaning = getConceptTranslation(
                        concept.name,
                        concept.simpleExplanation || concept.definition,
                        language
                      )

                      return (
                        <motion.div
                          key={concept.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="relative p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all space-y-3"
                        >
                          {/* Step number marker */}
                          <div className="absolute -left-[27px] top-5 w-6 h-6 rounded-full bg-indigo-600 text-white font-extrabold text-[11px] flex items-center justify-center ring-4 ring-slate-50">
                            {concept.stepNumber}
                          </div>

                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Step #{concept.stepNumber} · Level {concept.level}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  concept.status === 'MASTERED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : concept.status === 'WEAK'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-sky-50 text-sky-700 border-sky-200'
                                }`}>
                                  {concept.status.replace('_', ' ')}
                                </span>
                              </div>
                              <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                                {concept.name}
                              </h4>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-slate-700">
                                {concept.masteryScore}% Mastery
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSpeak(concept)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
                                title="Listen to explanation in selected language"
                              >
                                {speakingId === concept.id ? <VolumeX size={14} className="text-rose-600" /> : <Volume2 size={14} />}
                                <span>{speakingId === concept.id ? t('Stop', language) : t('Listen', language)}</span>
                              </button>
                            </div>
                          </div>

                          {/* Simple Meaning translated */}
                          <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                              <Sparkles size={11} className="text-indigo-600" /> {t('Simple Meaning', language)}
                            </span>
                            <p className="text-xs font-semibold text-indigo-950 leading-relaxed">
                              {translatedMeaning}
                            </p>
                          </div>

                          {/* Example & Details */}
                          {concept.examples?.length > 0 && (
                            <p className="text-[11px] text-slate-600 font-medium">
                              💡 <strong>{t('Real-World Example', language)}:</strong> {concept.examples[0]}
                            </p>
                          )}

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                            <Link
                              to={`/app/graph?documentId=${encodeURIComponent(selectedDocId)}`}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                              <Network size={13} /> View on Knowledge Graph
                            </Link>

                            <div className="flex items-center gap-2">
                              <Link
                                to={`/app/concepts/${encodeURIComponent(concept.id)}`}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1"
                              >
                                <BookOpen size={13} /> {t('Start Learning', language)}
                              </Link>
                              <Link
                                to={`/app/quizzes?conceptId=${encodeURIComponent(concept.id)}`}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1"
                              >
                                <Zap size={13} /> {t('Test Understanding', language)}
                              </Link>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
