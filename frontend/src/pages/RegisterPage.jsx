import { useState } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import FormField from '../components/FormField.jsx'
import PasswordField from '../components/PasswordField.jsx'
import { useAuth } from '../context/useAuth.js'

export default function RegisterPage() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/app" replace />

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) {
      setError('Your passwords do not match.')
      return
    }
    if (new TextEncoder().encode(form.password).length > 72) {
      setError('Choose a password that is no longer than 72 bytes.')
      return
    }
    setBusy(true)
    try {
      await register({ name: form.name, email: form.email, password: form.password })
      navigate('/app', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Start your flow" description="Create your private space to learn, connect, and remember." mode="register">
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField id="name" label="Full name" autoComplete="name" placeholder="What should we call you?" value={form.name} onChange={update('name')} required minLength={2} maxLength={80} />
        <FormField id="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={update('email')} required />
        <PasswordField id="password" label="Password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={update('password')} required minLength={8} />
        <PasswordField id="confirmPassword" label="Confirm password" autoComplete="new-password" placeholder="Enter your password again" value={form.confirmPassword} onChange={update('confirmPassword')} required minLength={8} />
        {error && <div className="form-alert" role="alert">{error}</div>}
        <button className="button button-primary auth-submit" type="submit" disabled={busy}>
          {busy ? <><LoaderCircle className="spin" size={17} /> Creating your space…</> : <>Create account <ArrowRight size={16} /></>}
        </button>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
    </AuthLayout>
  )
}
