import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { createAuthController } from '../controllers/auth-controller.js'
import { requireAuth } from '../middleware/require-auth.js'

export function createAuthRoutes(prisma) {
  const router = Router()
  const controller = createAuthController(prisma)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please try again in a few minutes.' },
  })

  router.post('/register', authLimiter, controller.register)
  router.post('/login', authLimiter, controller.login)
  router.post('/logout', controller.logout)
  router.get('/me', requireAuth, controller.me)
  return router
}
