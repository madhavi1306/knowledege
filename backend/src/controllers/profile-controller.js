import bcrypt from 'bcrypt'
import { publicUser } from '../services/auth-service.js'
import { updateProfileSchema } from '../utils/validation.js'

export function createProfileController(prisma) {
  return {
    get: async (req, res, next) => {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.userId } })
        if (!user) {
          return res.status(404).json({ error: 'Profile not found.' })
        }
        return res.json({ user: publicUser(user) })
      } catch (error) {
        return next(error)
      }
    },
    update: async (req, res, next) => {
      try {
        const input = updateProfileSchema.parse(req.body)
        const existingUser = await prisma.user.findUnique({ where: { id: req.userId } })
        if (!existingUser) {
          return res.status(404).json({ error: 'Profile not found.' })
        }

        if (input.newPassword) {
          const passwordMatches = await bcrypt.compare(input.currentPassword, existingUser.passwordHash)
          if (!passwordMatches) {
            return res.status(400).json({ error: 'Your current password is incorrect.' })
          }
        }

        const data = {}
        if (input.name !== undefined) data.name = input.name
        if (input.email !== undefined) data.email = input.email
        if (input.newPassword) data.passwordHash = await bcrypt.hash(input.newPassword, 12)

        const user = await prisma.user.update({
          where: { id: req.userId },
          data,
        })
        return res.json({ user: publicUser(user) })
      } catch (error) {
        if (error?.code === 'P2002') {
          return res.status(409).json({ error: 'An account with this email already exists.' })
        }
        return next(error)
      }
    },
  }
}
