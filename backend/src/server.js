import 'dotenv/config'
import { createApp } from './app.js'
import { prisma } from './utils/prisma.js'
import { FileStoreRepository } from './utils/file-store.js'

const port = Number(process.env.PORT || 4000)

if (!process.env.DATABASE_URL) {
  console.error('\n=============================================================')
  console.error('DATABASE CONFIGURATION ERROR:')
  console.error('DATABASE_URL is missing in backend/.env.')
  console.error('Example: DATABASE_URL="postgresql://postgres:password@localhost:5432/knowflow?schema=public"')
  console.error('=============================================================\n')
  process.exit(1)
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('\n=============================================================')
  console.error('SECURITY CONFIGURATION ERROR:')
  console.error('JWT_SECRET must be at least 32 characters long in backend/.env.')
  console.error('=============================================================\n')
  process.exit(1)
}

let db = prisma
try {
  await prisma.$connect()
  await prisma.$queryRaw`SELECT 1`
  console.log('✓ Connected to PostgreSQL database successfully.')
} catch (error) {
  console.warn('\n=============================================================')
  console.warn('POSTGRESQL CONNECTION NOTICE:')
  console.warn('Could not connect to the configured PostgreSQL database.')
  console.warn('Error code:', error.code || 'unknown')
  console.warn('\nSETUP INSTRUCTIONS:')
  console.warn('1. Install PostgreSQL 14+ on your system (e.g., from https://www.postgresql.org/download/windows/)')
  console.warn('2. Ensure PostgreSQL service is running on port 5432')
  console.warn('3. Create database: psql -U postgres -c "CREATE DATABASE knowflow;"')
  console.warn('4. Update DATABASE_URL in backend/.env with your credentials')
  console.warn('5. Run database migrations: npm run db:deploy')
  console.warn('--> Activating persistent disk storage engine (backend/storage/knowflow_db.json) for zero-downtime operation.')
  console.warn('=============================================================\n')
  db = new FileStoreRepository()
}

const app = createApp(db)
app.locals.persistenceBackend = db instanceof FileStoreRepository ? 'json-file-fallback' : 'postgresql'
if (app.locals.analysisService?.start) {
  try {
    await app.locals.analysisService.start()
    console.log('✓ Document processing & analysis engine background service started.')
  } catch (e) {
    console.warn('Analysis background service notice:', e.message)
  }
}

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✓ KNOWFLOW API listening on http://0.0.0.0:${port}`)
})

// Keep event loop active indefinitely
setInterval(() => {}, 1000 * 60 * 60)

const shutdown = async () => {
  server.close(async () => {
    if (app.locals.analysisService?.stop) await app.locals.analysisService.stop()
    if (typeof db.$disconnect === 'function') await db.$disconnect()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
