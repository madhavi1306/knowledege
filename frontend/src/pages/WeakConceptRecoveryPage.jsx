import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../services/api.js'

export default function WeakConceptRecoveryPage() {
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Reteach step state
  const [selectedStep, setSelectedStep] = useState(null)
  const [approach, setApproach] = useState('ANALOGY')
  const [reteaching, setReteaching] = useState(false)
  const [stepData, setStepData] = useState(null)

  // Mini test state
  const [miniAnswers, setMiniAnswers] = useState({})
  const [miniSubmitting, setMiniSubmitting] = useState(false)
  const [miniResult, setMiniResult] = useState(null)

  async function loadSessions() {
    setLoading(true)
    setError('')
    try {
      const res = await apiRequest('/api/recovery')
      setSessions(res.sessions || [])
      if (res.sessions?.length > 0) {
        setActiveSession(res.sessions[0])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  async function handleReteach(step, selectedApproach = 'ANALOGY') {
    setSelectedStep(step)
    setApproach(selectedApproach)
    setReteaching(true)
    setMiniResult(null)
    setMiniAnswers({})
    try {
      const res = await apiRequest(`/api/recovery/${activeSession.id}/steps/${step.id}/reteach`, {
        method: 'POST',
        body: { approach: selectedApproach },
      })
      setStepData(res.step)
    } catch (err) {
      setError(err.message)
    } finally {
      setReteaching(false)
    }
  }

  async function submitMiniTest() {
    if (!stepData) return
    setMiniSubmitting(true)
    try {
      const res = await apiRequest(
        `/api/recovery/${activeSession.id}/steps/${stepData.id}/submit-mini-test`,
        {
          method: 'POST',
          body: { answers: miniAnswers },
        }
      )
      setMiniResult(res)
      // Refresh active session steps
      loadSessions()
    } catch (err) {
      setError(err.message)
    } finally {
      setMiniSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="recovery-loading">
        <RefreshCw className="animate-spin" size={24} />
        <p>Loading Recovery Loop...</p>
      </div>
    )
  }

  return (
    <div className="recovery-page">
      <header className="recovery-header">
        <div>
          <h2>Automatic Weak-Concept Recovery Loop</h2>
          <p>
            When assessments detect knowledge gaps, KNOWFLOW doesn't stop at low scores. It constructs a targeted recovery path, reteaches concepts through alternative mental models, and verifies retention with instant mini-tests.
          </p>
        </div>
      </header>

      {sessions.length === 0 ? (
        <div className="card recovery-empty">
          <CheckCircle2 size={48} className="text-emerald-500 mb-2" />
          <h3>No Active Weak Concepts!</h3>
          <p>All your tested concepts currently show solid understanding and retention.</p>
          <div className="mt-4">
            <Link to="/app/quizzes" className="btn btn-primary">Take a Diagnostic Quiz</Link>
          </div>
        </div>
      ) : (
        <div className="recovery-grid">
          {/* Recovery steps queue */}
          <div className="card recovery-queue-card">
            <div className="queue-header">
              <h3>Recovery Queue</h3>
              <span className="badge badge-progress">{activeSession?.overallProgress || 0}% Cleared</span>
            </div>
            <p className="queue-subtext">Ordered prerequisite-first to repair foundational gaps before advanced topics.</p>

            <div className="steps-list">
              {activeSession?.steps?.map((s, idx) => (
                <div
                  key={s.id}
                  className={`step-item ${selectedStep?.id === s.id ? 'is-active' : ''} ${s.status === 'MASTERED' ? 'is-cleared' : ''}`}
                  onClick={() => handleReteach(s, 'ANALOGY')}
                >
                  <div className="step-badge">{idx + 1}</div>
                  <div className="step-info">
                    <strong>{s.conceptName}</strong>
                    <span className="step-status">Status: {s.status}</span>
                  </div>
                  {s.status === 'MASTERED' ? (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  ) : (
                    <Zap size={16} className="text-amber-500" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reteaching & Mini-Test Interactive Canvas */}
          <div className="recovery-workspace">
            {reteaching ? (
              <div className="card recovery-loading">
                <Sparkles className="animate-spin" size={24} />
                <p>Generating Alternative Pedagogical Mental Model...</p>
              </div>
            ) : stepData ? (
              <motion.div className="card recovery-reteach-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="reteach-header">
                  <div className="approach-selector">
                    <button
                      className={`btn btn-sm ${approach === 'ANALOGY' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleReteach(selectedStep, 'ANALOGY')}
                    >
                      <Lightbulb size={14} /> Analogy Approach
                    </button>
                    <button
                      className={`btn btn-sm ${approach === 'STEP_BY_STEP' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleReteach(selectedStep, 'STEP_BY_STEP')}
                    >
                      <BookOpen size={14} /> Step-by-Step
                    </button>
                    <button
                      className={`btn btn-sm ${approach === 'VISUAL_CONCRETE' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleReteach(selectedStep, 'VISUAL_CONCRETE')}
                    >
                      <Sparkles size={14} /> Visual Blueprint
                    </button>
                  </div>
                </div>

                {/* Explanation text */}
                <div className="reteach-content">
                  <h3>{stepData.reteachContent?.headline}</h3>

                  {approach === 'ANALOGY' && (
                    <div className="analogy-box">
                      <p className="lead-analogy">{stepData.reteachContent?.mainAnalogy}</p>
                      <p><strong>Why this analogy fits:</strong> {stepData.reteachContent?.whyItWorks}</p>
                      <p><strong>Real-world usage:</strong> {stepData.reteachContent?.realWorldApplication}</p>
                    </div>
                  )}

                  {approach === 'STEP_BY_STEP' && (
                    <div className="steps-box">
                      {stepData.reteachContent?.breakdownSteps?.map((line, i) => (
                        <div key={i} className="reteach-step-line">
                          <span className="step-num">{i + 1}</span>
                          <p>{line}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {approach === 'VISUAL_CONCRETE' && (
                    <div className="concrete-box">
                      <p><strong>Case Study:</strong> {stepData.reteachContent?.concreteCase}</p>
                      <div className="blueprint-box">
                        <code>{stepData.reteachContent?.diagramDescription}</code>
                      </div>
                      <p>{stepData.reteachContent?.practicalExercise}</p>
                    </div>
                  )}

                  <div className="takeaways-box">
                    <strong>Key Takeaways:</strong>
                    <ul>
                      {stepData.reteachContent?.keyTakeaways?.map((t, idx) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Targeted Mini-Test */}
                <div className="mini-test-section">
                  <div className="mini-test-header">
                    <h4>Targeted Mini-Test (Verify Understanding)</h4>
                    <span>2 verification questions</span>
                  </div>

                  {stepData.reteachContent?.miniTest?.map((q, qIndex) => (
                    <div key={q.id} className="mini-question">
                      <p><strong>Q{qIndex + 1}:</strong> {q.questionText}</p>
                      <div className="options-stack">
                        {q.options?.map((opt, optIdx) => (
                          <label key={optIdx} className="mini-opt-label">
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={miniAnswers[q.id] === opt}
                              onChange={() => setMiniAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  {miniResult && (
                    <div className={`mini-feedback ${miniResult.isPassed ? 'is-passed' : 'is-failed'}`}>
                      {miniResult.isPassed ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                      <div>
                        <strong>{miniResult.isPassed ? 'Mastery Verified!' : 'Needs further practice'} (Score: {miniResult.score}%)</strong>
                        <p>{miniResult.nextRecommendedAction}</p>
                      </div>
                    </div>
                  )}

                  <div className="mini-actions">
                    <button
                      className="btn btn-primary"
                      onClick={submitMiniTest}
                      disabled={miniSubmitting || Object.keys(miniAnswers).length === 0}
                    >
                      {miniSubmitting ? <><LoaderCircle className="animate-spin" size={15} /> Evaluating...</> : 'Submit Mini-Test'}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="card recovery-prompt">
                <Lightbulb size={36} className="text-amber-500 mb-2" />
                <h3>Select a Weak Concept from the Left</h3>
                <p>The AI will generate an alternative explanation (Analogy, Step-by-Step, or Blueprint) and a targeted mini-test to seal the gap.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
