import { Bell, Menu, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { getInitials } from '../utils/initials.js'

export default function AppTopbar({ onMenuClick, title }) {
  const { user } = useAuth()

  return (
    <header className="app-topbar">
      <div className="topbar-title-wrap">
        <button className="icon-button mobile-menu-button" onClick={onMenuClick} aria-label="Open navigation"><Menu size={21} /></button>
        <div className="topbar-title-block">
          <span className="topbar-kicker">YOUR WORKSPACE</span>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="topbar-divider" />
        <span className="notification-indicator" title="No notifications yet" aria-label="No notifications yet"><Bell size={19} /><i /></span>
        <Link className="topbar-user" to="/app/profile" aria-label="Open profile">
          <span className="avatar">{getInitials(user?.name) || <UserRound size={17} />}</span>
          <span className="topbar-user-name">{user?.name?.split(' ')[0]}</span>
        </Link>
      </div>
    </header>
  )
}
