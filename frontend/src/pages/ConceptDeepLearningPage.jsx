import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  HelpCircle,
  Layers,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'

export default function ConceptDeepLearningPage() {
  const { conceptId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview') // 'overview', 'deep', 'analogy', 'steps', 'misconceptions', 'practice'

  useEffect(() => {
    let active = true
    apiRequest(`/api/learning/concepts/${encodeURIComponent(conceptId)}`)
      .then((res) => {
        if (active) {
          setData(res.concept)
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
  }, [conceptId])

  if (loading) {
    return (
      <div className="concept-loading">
        <Sparkles className="animate-spin" size={28} />
        <p>Synthesizing Deep Learning Module...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="concept-error">
        <p>{error || 'Concept could not be found.'}</p>
        <Link to="/app/graph" className="btn btn-secondary">
          <ArrowLeft size={16} /> Return to Knowledge Map
        </Link>
      </div>
    )
  }

  return (
    <div className="concept-deep-page">
      <div className="concept-nav-back">
        <Link to="/app/graph">
          <ArrowLeft size={16} /> Back to Knowledge Map
        </Link>
      </div>

      <header className="concept-header">
        <div className="concept-title-row">
          <div>
            <span className="concept-eyebrow">DEEP LEARNING MODE</span>
            <h1>{data.name}</h1>
          </div>
          <div className="concept-badges">
            <span className="badge badge-difficulty">{data.difficulty}</span>
            <span className="badge badge-importance">{data.importance} Priority</span>
            <span className="badge badge-status">{data.mastery.status}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="concept-tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <BookOpen size={16} /> Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'deep' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('deep')}
          >
            <Layers size={16} /> Deep Explanation
          </button>
          <button
            className={`tab-btn ${activeTab === 'analogy' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('analogy')}
          >
            <Lightbulb size={16} /> Analogy & Examples
          </button>
          <button
            className={`tab-btn ${activeTab === 'steps' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('steps')}
          >
            <CheckCircle size={16} /> Step-by-Step
          </button>
          <button
            className={`tab-btn ${activeTab === 'misconceptions' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('misconceptions')}
          >
            <AlertTriangle size={16} /> Misconceptions
          </button>
          <button
            className={`tab-btn ${activeTab === 'practice' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('practice')}
          >
            <Zap size={16} /> Practice & Quiz
          </button>
        </nav>
      </header>

      {/* Main Tab View */}
      <main className="concept-body">
        {activeTab === 'overview' && (
          <motion.div className="tab-pane" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <section className="card mb-4">
              <h3>What is this concept?</h3>
              <p className="lead-text">{data.definition}</p>
              <h4>Why is it important?</h4>
              <p>{data.simpleExplanation}</p>
            </section>

            <section className="card mb-4">
              <h3>Learning Objectives</h3>
              <ul className="learning-obj-list">
                {data.learningObjectives.map((obj, i) => (
                  <li key={i}><CheckCircle size={16} className="text-emerald-500" /> {obj}</li>
                ))}
              </ul>
            </section>

            {data.prerequisites.length > 0 && (
              <section className="card mb-4">
                <h3>Prerequisites to Understand First</h3>
                <div className="prereq-cards">
                  {data.prerequisites.map((prereq) => (
                    <div key={prereq.id} className="prereq-item">
                      <strong>{prereq.name}</strong>
                      <p>{prereq.evidence || prereq.definition}</p>
                      <Link to={`/app/concepts/${prereq.id}`} className="text-link">Review Prerequisite →</Link>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        )}

        {activeTab === 'deep' && (
          <motion.div className="tab-pane" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <section className="card mb-4">
              <h3>Detailed Architectural Explanation</h3>
              <p className="prose">{data.detailedExplanation}</p>
            </section>

            {data.sources.length > 0 && (
              <section className="card mb-4">
                <h3>Original Source References</h3>
                <div className="source-citations">
                  {data.sources.map((src, i) => (
                    <div key={i} className="citation-box">
                      <span className="citation-meta">Page {src.pageNumber} · {src.documentName || 'Uploaded Material'}</span>
                      <q>{src.excerpt}</q>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        )}

        {activeTab === 'analogy' && (
          <motion.div className="tab-pane" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <section className="card highlight-card mb-4">
              <div className="card-badge"><Lightbulb size={18} /> Everyday Analogy</div>
              <h3>How to think about {data.name}</h3>
              <p className="analogy-text">{data.analogy}</p>
            </section>

            <section className="card mb-4">
              <h3>Real-World Scenario & Application</h3>
              <p>{data.realLifeExample}</p>
            </section>
          </motion.div>
        )}

        {activeTab === 'steps' && (
          <motion.div className="tab-pane" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <section className="card mb-4">
              <h3>Step-by-Step Deconstruction</h3>
              <div className="timeline-steps">
                {data.stepByStepExplanation.map((step, idx) => (
                  <div key={idx} className="timeline-step">
                    <div className="step-number">{idx + 1}</div>
                    <div className="step-text">{step}</div>
                  </div>
                ))}
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'misconceptions' && (
          <motion.div className="tab-pane" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <section className="card mb-4">
              <h3>Common Misconceptions & Traps</h3>
              <div className="misconception-grid">
                {data.misconceptions.map((item, idx) => (
                  <div key={idx} className="misconception-box">
                    <div className="misc-icon"><AlertTriangle size={18} /></div>
                    <div>
                      <strong>Common Mistake</strong>
                      <p>{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'practice' && (
          <motion.div className="tab-pane" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <section className="card practice-hero">
              <Zap size={32} className="text-amber-500" />
              <h3>Ready to internalize {data.name}?</h3>
              <p>Test your understanding across multi-difficulty diagnostic questions.</p>
              <div className="practice-actions">
                <Link to={`/app/quizzes?conceptId=${data.id}`} className="btn btn-primary">
                  Launch Concept Mini-Quiz
                </Link>
                <Link to={`/app/recovery`} className="btn btn-secondary">
                  Check Recovery Queue
                </Link>
              </div>
            </section>
          </motion.div>
        )}
      </main>
    </div>
  )
}
