import {
  BarChart3,
  ChevronLeft,
  CircleHelp,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Mic,
  Network,
  RotateCcw,
  Repeat,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import Brand from './Brand.jsx'
import { useAuth } from '../context/useAuth.js'

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/app' },
  { label: 'Documents', icon: FileText, to: '/app/papers' },
  { label: 'Learning Progress', icon: BarChart3, to: '/app/analytics' },
  { label: 'Knowledge Graph', icon: Network, to: '/app/graph' },
  { label: 'Tests', icon: ClipboardCheck, to: '/app/quizzes' },
  { label: 'Revision', icon: Repeat, to: '/app/revision' },
  { label: 'Weak Topics', icon: RotateCcw, to: '/app/recovery' },
]

export default function AppSidebar({ open, onClose, collapsed, onToggleCollapsed }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState('')

  async function handleSignOut() {
    setLogoutError('')
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      setLogoutError(error.message)
    }
  }

  function handleOpenVoice() {
    window.dispatchEvent(new CustomEvent('knowflow:open-voice'))
  }

  return (
    <>
      <button className={`sidebar-scrim${open ? ' is-visible' : ''}`} onClick={onClose} aria-label="Close navigation" tabIndex={open ? 0 : -1} />
      <aside className={`app-sidebar${open ? ' sidebar-open' : ''}${collapsed ? ' sidebar-collapsed' : ''}`}>
        <div className="sidebar-brand">
          <NavLink to="/app" aria-label="Knowflow dashboard"><Brand /></NavLink>
          <button className="icon-button mobile-sidebar-close" onClick={onClose} aria-label="Close menu"><X size={19} /></button>
        </div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon, to }) => (
            <NavLink key={label} to={to} end={to === '/app'} className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link-active' : ''}`} title={collapsed ? label : undefined}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* AI Voice Assistant Trigger in Sidebar */}
        <div className="sidebar-voice-section px-3 py-2">
          <button
            type="button"
            className="sidebar-voice-btn"
            onClick={handleOpenVoice}
            title={collapsed ? 'AI Voice Assistant' : undefined}
          >
            <Mic size={17} className="text-indigo-400" />
            <span>AI Voice</span>
            <span className="sidebar-voice-tag">ASSIST</span>
          </button>
        </div>

        <div className="sidebar-spacer" />
        <div className="sidebar-help-card">
          <span className="help-card-icon"><CircleHelp size={18} /></span>
          <div><strong>Your learning workspace</strong><p>Study, test, and track your progress.</p></div>
        </div>
        {logoutError && <p className="sidebar-logout-error" role="alert">{logoutError}</p>}
        <button className="sidebar-link sidebar-logout" type="button" onClick={handleSignOut} title={collapsed ? 'Sign out' : undefined}>
          <LogOut size={18} strokeWidth={1.8} /><span>Sign out</span>
        </button>
        <NavLink to="/app/profile" className={({ isActive }) => `sidebar-link sidebar-settings${isActive ? ' sidebar-link-active' : ''}`}>
          <Settings size={18} strokeWidth={1.8} /><span>Settings</span>
        </NavLink>
        <button className="sidebar-collapse icon-button" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <ChevronLeft size={17} />
        </button>
      </aside>
    </>
  )
}
