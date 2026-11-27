import { ZodError } from 'zod'

export function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: error.issues[0]?.message ?? 'Please check the information you entered.',
      issues: error.issues.map(({ path, message }) => ({ path, message })),
    })
  }

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' })
  }

  console.error(error)
  return res.status(500).json({ error: 'Something went wrong. Please try again.' })
}
