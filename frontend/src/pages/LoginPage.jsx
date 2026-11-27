import { useState } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import FormField from '../components/FormField.jsx'
import PasswordField from '../components/PasswordField.jsx'
import { useAuth } from '../context/useAuth.js'

export default function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/app" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn({ email, password })
      navigate(location.state?.from || '/app', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" description="Pick up where your curiosity left off." mode="login">
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField id="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <PasswordField id="password" label="Password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <div className="form-alert" role="alert">{error}</div>}
        <button className="button button-primary auth-submit" type="submit" disabled={busy}>
          {busy ? <><LoaderCircle className="spin" size={17} /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
        </button>
      </form>
      <p className="auth-switch">New to Knowflow? <Link to="/register">Create an account</Link></p>
    </AuthLayout>
  )
}
