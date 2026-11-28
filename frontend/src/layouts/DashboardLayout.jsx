import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AppSidebar from '../components/AppSidebar.jsx'
import AppTopbar from '../components/AppTopbar.jsx'
import VoiceAgentOverlay from '../components/VoiceAgentOverlay.jsx'

function pageTitle(pathname) {
  if (pathname.endsWith('/papers')) return 'Document Library'
  if (pathname.endsWith('/profile')) return 'Settings & Profile'
  if (pathname.endsWith('/analytics') || pathname.endsWith('/progress')) return 'Learning Progress'
  if (pathname.endsWith('/graph') || pathname.endsWith('/knowledge-graph')) return 'Knowledge Graph'
  if (pathname.endsWith('/quizzes')) return 'Tests & Quizzes'
  if (pathname.endsWith('/recovery')) return 'Weak Topics'
  if (pathname.endsWith('/revision')) return 'Revision'
  if (pathname.endsWith('/learning-path')) return 'Learning Path'
  return 'Dashboard'
}

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  return (
    <div className={`app-frame${collapsed ? ' app-frame-collapsed' : ''}`}>
      <AppSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
      />
      <div className="app-main">
        <AppTopbar onMenuClick={() => setMobileOpen(true)} title={pageTitle(location.pathname)} />
        <main className="app-content"><Outlet /></main>
      </div>
      <VoiceAgentOverlay currentContext={{ pathname: location.pathname }} />
    </div>
  )
}
