import jwt from 'jsonwebtoken'

export const AUTH_COOKIE = 'knowflow_session'
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000

export function signSession(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  }
}
