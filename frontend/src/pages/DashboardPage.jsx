import { motion } from 'framer-motion'
import {
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
import { useAuth } from '../context/useAuth.js'

const overview = [
  { label: 'Papers added', value: '0', detail: 'Your library is ready', icon: FileText, tint: 'blue' },
  { label: 'Concepts explored', value: '0', detail: 'Ideas you have connected', icon: BrainCircuit, tint: 'violet' },
  { label: 'Learning progress', value: '0%', detail: 'Your journey starts here', icon: Target, tint: 'mint' },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'learner'

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
          <p>Your learning space is ready. When you're ready, bring in something you'd like to understand.</p>
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
          <div className="activity-empty">
            <span className="empty-icon"><CircleDashed size={23} /></span>
            <strong>A little room for what’s next</strong>
            <p>Your learning activity will appear here once you get started.</p>
          </div>
        </section>
      </div>

      <section className="next-step-card">
        <div className="next-step-icon"><CheckCircle2 size={20} /></div>
        <div className="next-step-copy">
          <span className="eyebrow">YOUR NEXT STEP</span>
          <h3>Your space is set up. You’re ready for your first paper.</h3>
          <p>Document learning is coming in the next phase. Nothing to set up right now.</p>
        </div>
        <span className="next-step-soon"><BookOpen size={15} /> Coming soon</span>
      </section>
      <div className="dashboard-footer-note"><span><Sparkles size={13} /></span> Your learning data is private and belongs to you.</div>
    </div>
  )
}
