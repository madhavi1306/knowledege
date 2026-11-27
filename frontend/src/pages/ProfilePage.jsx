import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, LoaderCircle, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import FormField from '../components/FormField.jsx'
import PasswordField from '../components/PasswordField.jsx'
import { apiRequest } from '../services/api.js'
import { getInitials } from '../utils/initials.js'

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/api/profile')
      .then(({ user: profile }) => {
        if (active) {
          setUser(profile)
          setForm({ name: profile.name, email: profile.email })
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [setUser])

  function updateForm(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  function updatePassword(field) {
    return (event) => setPasswords((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (passwords.newPassword && passwords.newPassword !== passwords.confirmPassword) {
      setError('Your new passwords do not match.')
      return
    }
    if (passwords.newPassword && new TextEncoder().encode(passwords.newPassword).length > 72) {
      setError('Choose a password that is no longer than 72 bytes.')
      return
    }
    const changedProfile = form.name !== user.name || form.email !== user.email
    if (!changedProfile && !passwords.newPassword) {
      setError('Make a change to your profile or add a new password before saving.')
      return
    }
    setBusy(true)
    try {
      const update = { name: form.name, email: form.email }
      if (passwords.newPassword) {
        update.currentPassword = passwords.currentPassword
        update.newPassword = passwords.newPassword
      }
      const { user: updatedUser } = await apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(update),
      })
      setUser(updatedUser)
      setForm({ name: updatedUser.name, email: updatedUser.email })
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setSuccess('Your profile has been updated.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-intro">
        <span className="eyebrow">YOUR ACCOUNT</span>
        <h2>Make this space yours.</h2>
        <p>Keep your account details up to date. Your learning data stays private to you.</p>
      </div>
      <section className="profile-card">
        <div className="profile-card-heading">
          <div className="profile-avatar-large">{getInitials(user?.name) || <UserRound size={25} />}</div>
          <div><h3>Personal details</h3><p>Update your name and email address.</p></div>
        </div>
        {loading ? (
          <div className="inline-loading"><span className="spinner" /> Loading your profile…</div>
        ) : (
          <form className="profile-form" onSubmit={handleSubmit}>
            <FormField id="name" label="Full name" autoComplete="name" value={form.name} onChange={updateForm('name')} required minLength={2} maxLength={80} />
            <FormField id="email" label="Email address" type="email" autoComplete="email" value={form.email} onChange={updateForm('email')} required />
            <div className="profile-section-divider"><span className="profile-divider-icon"><LockKeyhole size={15} /></span><div><h4>Change password</h4><p>Leave these fields empty if you don’t want to change your password.</p></div></div>
            <PasswordField id="currentPassword" label="Current password" autoComplete="current-password" placeholder="Required to change password" value={passwords.currentPassword} onChange={updatePassword('currentPassword')} />
            <PasswordField id="newPassword" label="New password" autoComplete="new-password" placeholder="At least 8 characters" value={passwords.newPassword} onChange={updatePassword('newPassword')} minLength={8} />
            <PasswordField id="confirmNewPassword" label="Confirm new password" autoComplete="new-password" placeholder="Enter your new password again" value={passwords.confirmPassword} onChange={updatePassword('confirmPassword')} minLength={8} />
            {error && <div className="form-alert" role="alert">{error}</div>}
            {success && <div className="form-success" role="status"><CheckCircle2 size={16} />{success}</div>}
            <div className="profile-form-footer">
              <span><Mail size={14} /> Account created {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'recently'}</span>
              <button className="button button-primary" type="submit" disabled={busy}>
                {busy ? <><LoaderCircle className="spin" size={16} /> Saving…</> : <>Save changes <ArrowRight size={15} /></>}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
