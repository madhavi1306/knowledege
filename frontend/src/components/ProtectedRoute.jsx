import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

export default function ProtectedRoute({ children }) {
  const { user, loading, authError } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="screen-state" role="status">
        <span className="spinner" />
        <span>Getting your learning space ready…</span>
      </div>
    )
  }

  if (!user && authError) {
    return (
      <div className="screen-state screen-state-error" role="alert">
        <p>{authError}</p>
        <a className="button button-primary" href="/login">Go to sign in</a>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
