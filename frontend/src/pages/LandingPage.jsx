import { motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  CirclePlay,
  Compass,
  Lightbulb,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import learningArt from '../assets/learning-illustration.svg'

const features = [
  { icon: BookOpen, color: 'blue', title: 'Learn with clarity', text: 'Turn complex material into ideas that feel simple, clear, and connected.' },
  { icon: BrainCircuit, color: 'violet', title: 'Make connections', text: 'See how what you learn fits together, so knowledge makes sense as a whole.' },
  { icon: Compass, color: 'peach', title: 'Find your flow', text: 'Build a steady learning rhythm that keeps you moving at your own pace.' },
]

const steps = [
  { number: '01', title: 'Bring your materials', text: 'Start with the study resources that matter to you.' },
  { number: '02', title: 'Explore the ideas', text: 'Make sense of topics and the connections between them.' },
  { number: '03', title: 'Remember what counts', text: 'Practice, revisit, and grow your understanding over time.' },
]

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link to="/" aria-label="Knowflow home"><Brand /></Link>
          <nav className="landing-nav-links" aria-label="Main navigation">
            <a href="#features">Why Knowflow</a>
            <a href="#how-it-works">How it works</a>
          </nav>
          <div className="landing-nav-actions">
            <Link className="nav-login-link" to="/login">Log in</Link>
            <Link className="button button-small button-dark" to="/register">Get started <ArrowRight size={15} /></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />
          <div className="hero-inner">
            <motion.div
              className="hero-copy"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <div className="hero-pill"><Sparkles size={14} /> A calmer way to learn</div>
              <h1>Make learning<br />feel <span>like it flows.</span></h1>
              <p className="hero-description">Bring your ideas together, understand the bigger picture, and make what you learn stay with you.</p>
              <div className="hero-actions">
                <Link to="/register" className="button button-primary button-large">Start learning for free <ArrowRight size={17} /></Link>
                <a className="button button-quiet button-large" href="#how-it-works"><CirclePlay size={18} /> See how it works</a>
              </div>
              <div className="hero-note"><span className="hero-note-check"><Check size={12} /></span> A focused space for your learning journey</div>
            </motion.div>
            <motion.div
              className="hero-art-wrap"
              initial={{ opacity: 0, scale: 0.96, x: 8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.65, delay: 0.1 }}
            >
              <div className="hero-art-glass">
                <img src={learningArt} alt="A learner connecting ideas on a bright, flowing knowledge map" />
              </div>
              <div className="floating-note floating-note-top"><span className="floating-note-icon"><Lightbulb size={16} /></span><span><b>Ideas connect</b><small>See the bigger picture</small></span></div>
              <div className="floating-note floating-note-bottom"><span className="mini-progress"><i /></span><span><b>Your pace, your path</b><small>One idea at a time</small></span></div>
              <div className="hero-art-spark spark-a">✦</div><div className="hero-art-spark spark-b">✧</div>
            </motion.div>
          </div>
          <a className="scroll-cue" href="#features"><span>Get to know Knowflow</span><ArrowDown size={14} /></a>
        </section>

        <section className="features-section section-wrap" id="features">
          <div className="section-heading">
            <span className="eyebrow">LEARNING, REIMAGINED</span>
            <h2>More than collecting notes.<br /><span>A way to truly understand.</span></h2>
            <p>Learning is easier when every idea has somewhere to land.</p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, color, title, text }, index) => (
              <motion.article
                className="feature-card"
                key={title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
              >
                <div className={`feature-icon feature-icon-${color}`}><Icon size={20} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="feature-card-arrow"><ArrowRight size={16} /></span>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-wrap how-inner">
            <div className="how-heading">
              <span className="eyebrow">A LITTLE LESS OVERWHELM</span>
              <h2>Small steps.<br /><span>Lasting understanding.</span></h2>
              <p>Knowflow gives your curiosity room to breathe. Start with what you have, and grow from there.</p>
              <Link to="/register" className="text-link">Find your learning flow <ArrowRight size={16} /></Link>
            </div>
            <div className="steps-list">
              {steps.map(({ number, title, text }, index) => (
                <motion.div
                  className="step-row"
                  key={number}
                  initial={{ opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.4, delay: index * 0.09 }}
                >
                  <span className="step-number">{number}</span>
                  <div><h3>{title}</h3><p>{text}</p></div>
                  <span className="step-line" aria-hidden="true" />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="closing-section">
          <div className="closing-card">
            <div className="closing-orb closing-orb-one" /><div className="closing-orb closing-orb-two" />
            <span className="closing-spark"><Sparkles size={17} /></span>
            <h2>Ready to find your flow?</h2>
            <p>Your next idea could change how everything else makes sense.</p>
            <Link to="/register" className="button button-white button-large">Get started <ArrowRight size={17} /></Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <Link to="/" aria-label="Knowflow home"><Brand /></Link>
        <p>Learn. Connect. Remember.</p>
        <span>© KNOWFLOW</span>
      </footer>
    </div>
  )
}
