import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api.js'
import { AuthContext } from './auth-context.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/api/auth/me')
      .then(({ user: currentUser }) => {
        if (active) {
          setUser(currentUser)
          setAuthError('')
        }
      })
      .catch((error) => {
        if (active && error.status !== 401) setAuthError(error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const signIn = useCallback(async (credentials) => {
    const { user: currentUser } = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    setUser(currentUser)
    setAuthError('')
    return currentUser
  }, [])

  const register = useCallback(async (details) => {
    const { user: currentUser } = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(details),
    })
    setUser(currentUser)
    setAuthError('')
    return currentUser
  }, [])

  const signOut = useCallback(async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, authError, signIn, register, signOut, setUser }),
    [user, loading, authError, signIn, register, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
