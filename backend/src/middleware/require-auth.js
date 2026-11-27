import jwt from 'jsonwebtoken'
import { AUTH_COOKIE } from '../utils/token.js'

export function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE]
  if (!token) {
    return res.status(401).json({ error: 'Please sign in to continue.' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      return res.status(401).json({ error: 'Your session is invalid. Please sign in again.' })
    }

    req.userId = payload.sub
    return next()
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
  }
}
