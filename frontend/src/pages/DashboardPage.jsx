import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileText,
  Lightbulb,
  Sparkles,
  Target,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { apiRequest } from '../services/api.js'

function activityDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [papers, setPapers] = useState({ totalCount: null, items: [], error: '' })
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'learner'

  useEffect(() => {
    let active = true
    apiRequest('/api/documents?limit=5')
      .then((result) => {
        if (active) setPapers({ totalCount: result.totalCount, items: result.items, error: '' })
      })
      .catch((error) => {
        if (active) setPapers({ totalCount: null, items: [], error: error.message })
      })
    return () => { active = false }
  }, [])

  const overview = [
    {
      label: 'Papers added',
      value: papers.totalCount === null ? '—' : papers.totalCount,
      detail: papers.error ? 'Papers could not be loaded' : papers.totalCount === null ? 'Syncing your library' : 'In your private library',
      icon: FileText,
      tint: 'blue',
    },
    { label: 'Concepts explored', value: '0', detail: 'No concepts analyzed yet', icon: BrainCircuit, tint: 'violet' },
    { label: 'Learning progress', value: '0%', detail: 'Learning progress starts later', icon: Target, tint: 'mint' },
  ]

  return (
    <div className="dashboard-page">
      <motion.section
        className="welcome-banner"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="welcome-copy">
          <span className="eyebrow"><Sparkles size={14} /> A FRESH PAGE</span>
          <h2>Welcome to your flow, {firstName}<span className="welcome-wave">✦</span></h2>
          <p>Your learning space is ready. Bring in a PDF whenever you’re ready to start learning from it.</p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="welcome-art-circle circle-back" />
          <div className="welcome-art-circle circle-front"><BookOpen size={35} /></div>
          <span className="welcome-art-spark spark-left">✧</span><span className="welcome-art-spark spark-right">✦</span>
          <div className="welcome-art-line" />
        </div>
      </motion.section>

      <section className="overview-grid" aria-label="Learning overview">
        {overview.map(({ label, value, detail, icon: Icon, tint }, index) => (
          <motion.article
            className="overview-card"
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.06 }}
          >
            <div className={`overview-icon overview-icon-${tint}`}><Icon size={18} /></div>
            <div className="overview-label">{label}</div>
            <div className="overview-value">{value}</div>
            <div className="overview-detail">{detail}</div>
          </motion.article>
        ))}
      </section>

      <div className="dashboard-content-grid">
        <section className="dashboard-panel learning-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">YOUR JOURNEY</span><h3>Learning progress</h3></div>
            <span className="period-chip"><Clock3 size={13} /> All time</span>
          </div>
          <div className="progress-empty">
            <div className="progress-ring" aria-label="0 percent learning progress"><span>0<small>%</small></span></div>
            <div><strong>Your progress starts with your first lesson.</strong><p>As you learn, your actual activity will appear here.</p></div>
          </div>
          <div className="panel-divider" />
          <div className="weak-concepts-row">
            <div className="weak-concepts-icon"><Lightbulb size={17} /></div>
            <div><strong>Concepts to revisit</strong><p>No learning data yet. Weak concepts will show up after you study.</p></div>
            <span className="count-pill">0</span>
          </div>
        </section>

        <section className="dashboard-panel activity-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">THE LATEST</span><h3>Recent activity</h3></div>
            <span className="activity-clock"><Clock3 size={16} /></span>
          </div>
          {papers.items.length > 0 ? (
            <div className="recent-paper-list">
              {papers.items.slice(0, 4).map((paper) => (
                <Link className="recent-paper" to={`/app/papers`} key={paper.id}>
                  <span className="recent-paper-icon"><FileText size={15} /></span>
                  <span className="recent-paper-copy"><strong title={paper.fileName}>{paper.fileName}</strong><small>PDF added · {activityDate(paper.uploadedAt)}</small></span>
                  <span className={`document-status status-${paper.uploadStatus.toLowerCase()}`}>{paper.uploadStatus === 'UPLOADED' ? 'Uploaded' : paper.uploadStatus}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="activity-empty">
              <span className="empty-icon"><CircleDashed size={23} /></span>
              <strong>{papers.error ? 'Your papers are unavailable' : 'A little room for what’s next'}</strong>
              <p>{papers.error || 'Your recent paper uploads will appear here.'}</p>
            </div>
          )}
        </section>
      </div>

      <section className="next-step-card">
        <div className="next-step-icon"><CheckCircle2 size={20} /></div>
        <div className="next-step-copy">
          <span className="eyebrow">YOUR NEXT STEP</span>
          <h3>{papers.totalCount ? 'Keep your study materials in one place.' : 'Add a paper to start your library.'}</h3>
          <p>Upload one PDF or a whole batch. There’s no document-count limit.</p>
        </div>
        <Link className="next-step-link" to="/app/papers">{papers.totalCount ? 'View papers' : 'My Papers'} <ArrowRight size={15} /></Link>
      </section>
      <div className="dashboard-footer-note"><span><Sparkles size={13} /></span> Your learning data is private and belongs to you.</div>
    </div>
  )
}
