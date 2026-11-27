import { authenticateUser, registerUser } from '../services/auth-service.js'
import { AUTH_COOKIE, sessionCookieOptions, signSession } from '../utils/token.js'
import { loginSchema, registerSchema } from '../utils/validation.js'

export function createAuthController(prisma) {
  return {
    register: async (req, res, next) => {
      try {
        const input = registerSchema.parse(req.body)
        const user = await registerUser(prisma, input)
        res.cookie(AUTH_COOKIE, signSession(user.id), sessionCookieOptions())
        return res.status(201).json({ user })
      } catch (error) {
        if (error?.code === 'P2002') {
          return res.status(409).json({ error: 'An account with this email already exists.' })
        }
        return next(error)
      }
    },
    login: async (req, res, next) => {
      try {
        const input = loginSchema.parse(req.body)
        const user = await authenticateUser(prisma, input)
        if (!user) {
          return res.status(401).json({ error: 'Email or password is incorrect.' })
        }

        res.cookie(AUTH_COOKIE, signSession(user.id), sessionCookieOptions())
        return res.json({ user })
      } catch (error) {
        return next(error)
      }
    },
    logout: (_req, res) => {
      res.clearCookie(AUTH_COOKIE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      })
      return res.status(204).end()
    },
    me: async (req, res, next) => {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.userId } })
        if (!user) {
          return res.status(401).json({ error: 'Your account is no longer available. Please sign in again.' })
        }
        return res.json({ user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt } })
      } catch (error) {
        return next(error)
      }
    },
  }
}
