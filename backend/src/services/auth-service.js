import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

export function publicUser(user) {
  const { id, name, email, createdAt, updatedAt } = user
  return { id, name, email, createdAt, updatedAt }
}

export async function registerUser(prisma, input) {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS)
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
    },
  })
  return publicUser(user)
}

export async function authenticateUser(prisma, input) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    return null
  }
  return publicUser(user)
}
