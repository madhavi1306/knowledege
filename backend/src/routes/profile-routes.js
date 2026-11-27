import { Router } from 'express'
import { createProfileController } from '../controllers/profile-controller.js'
import { requireAuth } from '../middleware/require-auth.js'

export function createProfileRoutes(prisma) {
  const router = Router()
  const controller = createProfileController(prisma)

  router.use(requireAuth)
  router.get('/', controller.get)
  router.put('/', controller.update)
  return router
}
