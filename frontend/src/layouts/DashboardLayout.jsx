import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AppSidebar from '../components/AppSidebar.jsx'
import AppTopbar from '../components/AppTopbar.jsx'

function pageTitle(pathname) {
  if (pathname.endsWith('/papers')) return 'My Papers'
  return pathname.endsWith('/profile') ? 'Your profile' : 'Dashboard'
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
    </div>
  )
}
