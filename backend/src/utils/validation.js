import { z } from 'zod'

const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address.')
  .max(254, 'Email must be 254 characters or fewer.')
  .transform((email) => email.toLowerCase())

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
    message: 'Password must be 72 bytes or fewer.',
  })

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
})

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    email: emailSchema.optional(),
    currentPassword: z.string().optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.email !== undefined ||
      body.newPassword !== undefined,
    { message: 'Provide a name, email, or password to update.' },
  )
  .refine(
    (body) =>
      (body.newPassword === undefined && body.currentPassword === undefined) ||
      (body.newPassword !== undefined && Boolean(body.currentPassword)),
    { message: 'Enter your current password to set a new password.' },
  )
