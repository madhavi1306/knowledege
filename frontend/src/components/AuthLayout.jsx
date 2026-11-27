import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from './Brand.jsx'

export default function AuthLayout({ children, title, description, mode }) {
  return (
    <main className="auth-page">
      <div className="auth-topline">
        <Link to="/" aria-label="Back to KNOWFLOW home"><Brand /></Link>
        <Link className="auth-back-link" to="/"><ArrowLeft size={15} /> Back to home</Link>
      </div>
      <div className="auth-columns">
        <motion.section
          className="auth-panel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="auth-heading">
            <span className="eyebrow"><Sparkles size={14} /> YOUR LEARNING SPACE</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {children}
          <p className="auth-privacy">Your learning space is private and only accessible to you.</p>
        </motion.section>
        <aside className={`auth-aside auth-aside-${mode}`} aria-label="Knowflow learning philosophy">
          <div className="auth-aside-orbit orbit-one" />
          <div className="auth-aside-orbit orbit-two" />
          <div className="auth-aside-content">
            <div className="auth-aside-icon"><Sparkles size={22} /></div>
            <p className="auth-aside-quote">“The beautiful thing about learning is that nobody can take it away from you.”</p>
            <span className="auth-aside-caption">Make every idea stick.</span>
          </div>
          <div className="auth-aside-dots" aria-hidden="true">✦ &nbsp; · &nbsp; ✧ &nbsp; · &nbsp; ✦</div>
        </aside>
      </div>
    </main>
  )
}
