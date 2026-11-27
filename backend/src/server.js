import 'dotenv/config'
import { createApp } from './app.js'
import { prisma } from './utils/prisma.js'

const port = Number(process.env.PORT || 4000)

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.')
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a secret with at least 32 characters.')
}

try {
  await prisma.$connect()
  const app = createApp(prisma)
  await app.locals.analysisService.start()
  const server = app.listen(port, () => {
    console.log(`KNOWFLOW API listening on http://localhost:${port}`)
  })

  const shutdown = async () => {
    server.close(async () => {
      await app.locals.analysisService.stop()
      await prisma.$disconnect()
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
} catch (error) {
  console.error('Unable to start KNOWFLOW API. Check PostgreSQL connectivity and apply pending migrations.', error)
  await prisma.$disconnect()
  process.exitCode = 1
}
