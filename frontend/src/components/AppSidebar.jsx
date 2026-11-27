import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  ChevronLeft,
  CircleHelp,
  ClipboardCheck,
  Compass,
  LayoutDashboard,
  LogOut,
  Map,
  Settings,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import Brand from './Brand.jsx'
import { useAuth } from '../context/useAuth.js'

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/app' },
  { label: 'My Papers', icon: BookOpen, to: '/app/papers' },
  { label: 'Knowledge Map', icon: Map },
  { label: 'Learning Path', icon: Compass },
  { label: 'AI Tutor', icon: BrainCircuit },
  { label: 'Quiz & Assessments', icon: ClipboardCheck },
  { label: 'Progress & Analytics', icon: BarChart3 },
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
            to ? (
              <NavLink key={label} to={to} end className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link-active' : ''}`} title={collapsed ? label : undefined}>
                <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              </NavLink>
            ) : (
              <div className="sidebar-link sidebar-link-disabled" key={label} aria-disabled="true" title={`${label} will be available in a future phase`}>
                <Icon size={18} strokeWidth={1.8} /><span>{label}</span><span className="sidebar-lock">Soon</span>
              </div>
            )
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-help-card">
          <span className="help-card-icon"><CircleHelp size={18} /></span>
          <div><strong>Here to help</strong><p>Your learning journey starts here.</p></div>
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
