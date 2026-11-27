import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { PDFDocument } from 'pdf-lib'
import { createApp } from '../src/app.js'
import { signSession } from '../src/utils/token.js'

process.env.JWT_SECRET = 'test-only-secret-for-knowflow-auth-suite'
process.env.NODE_ENV = 'test'

let server
let baseUrl
let storageDir
let documents

function uniqueError() {
  const error = new Error('Unique constraint')
  error.code = 'P2002'
  return error
}

function filteredDocuments(where) {
  return [...documents.values()].filter((document) => {
    if (document.userId !== where.userId) return false
    if (where.uploadStatus && document.uploadStatus !== where.uploadStatus) return false
    if (where.OR) {
      const search = where.OR[0].fileName.contains.toLowerCase()
      if (!`${document.fileName} ${document.originalFileName}`.toLowerCase().includes(search)) return false
    }
    return true
  })
}

function createTestPrisma() {
  return {
    document: {
      async create({ data }) {
        if ([...documents.values()].some((item) => item.userId === data.userId && item.contentHash === data.contentHash)) {
          throw uniqueError()
        }
        const now = new Date()
        const document = { id: crypto.randomUUID(), ...data, uploadedAt: now, updatedAt: now }
        documents.set(document.id, document)
        return document
      },
      async findUnique({ where }) {
        const { userId, contentHash } = where.userId_contentHash
        return [...documents.values()].find((item) => item.userId === userId && item.contentHash === contentHash) ?? null
      },
      async findFirst({ where }) {
        const document = documents.get(where.id)
        return document?.userId === where.userId ? document : null
      },
      async findMany({ where, cursor, skip = 0, take }) {
        const result = filteredDocuments(where).sort((a, b) => (
          b.uploadedAt - a.uploadedAt || b.id.localeCompare(a.id)
        ))
        const start = cursor ? result.findIndex((item) => item.id === cursor.id) + skip : 0
        return result.slice(start, start + take)
      },
      async count({ where }) {
        return filteredDocuments(where).length
      },
      async delete({ where }) {
        const document = documents.get(where.id)
        documents.delete(where.id)
        return document
      },
    },
  }
}

function authCookie(userId) {
  return `knowflow_session=${signSession(userId)}`
}

async function request(pathname, { method = 'GET', body, userId } = {}) {
  const headers = {}
  if (userId) headers.cookie = authCookie(userId)
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    ...(body ? { body } : {}),
  })
}

function makeForm(fileName, bytes, type = 'application/pdf') {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type }), fileName)
  return form
}

async function makePdf(trailingSpaceCount = 0) {
  const pdf = await PDFDocument.create()
  pdf.addPage([612 + trailingSpaceCount, 792])
  const bytes = Buffer.from(await pdf.save())
  return trailingSpaceCount ? Buffer.concat([bytes, Buffer.alloc(trailingSpaceCount, 0x20)]) : bytes
}

async function upload(userId, fileName, bytes, type) {
  return request('/api/documents/upload', {
    method: 'POST',
    userId,
    body: makeForm(fileName, bytes, type),
  })
}

before(async () => {
  documents = new Map()
  storageDir = await mkdtemp(path.join(os.tmpdir(), 'knowflow-documents-'))
  server = createApp(createTestPrisma(), {
    storageDir,
    maxPdfSizeMb: 1,
    concurrency: 2,
  }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) {
    server.close()
    await once(server, 'close')
  }
  if (storageDir) await rm(storageDir, { recursive: true, force: true })
})

test('rejects unauthenticated, invalid, corrupted, and oversized uploads', async () => {
  const unauthorized = await request('/api/documents')
  assert.equal(unauthorized.status, 401)

  const invalidType = await upload('user-a', 'notes.txt', Buffer.from('not a PDF'), 'text/plain')
  assert.equal(invalidType.status, 400)

  const corrupted = await upload('user-a', 'broken.pdf', Buffer.from('%PDF-1.7\nnot a document\n%%EOF'))
  assert.equal(corrupted.status, 400)

  const validPdf = await makePdf()
  const oversized = Buffer.concat([validPdf, Buffer.alloc(1024 * 1024, 0x20)])
  const tooLarge = await upload('user-a', 'large.pdf', oversized)
  assert.equal(tooLarge.status, 413)
  assert.match((await tooLarge.json()).error, /per-file limit of 1 MB/)
})

test('queues and stores more than one hundred PDFs without a document-count cap', async () => {
  const firstPdf = await makePdf()
  const uploads = await Promise.all(Array.from({ length: 105 }, async (_value, index) => {
    const bytes = index === 0 ? firstPdf : await makePdf(index)
    return upload('user-a', `batch-paper-${index}.pdf`, bytes)
  }))

  assert.equal(uploads.filter((response) => response.status === 201).length, 105)

  const duplicate = await upload('user-a', 'duplicate.pdf', firstPdf)
  assert.equal(duplicate.status, 409)

  const firstPage = await request('/api/documents?limit=24', { userId: 'user-a' })
  assert.equal(firstPage.status, 200)
  const page = await firstPage.json()
  assert.equal(page.totalCount, 105)
  assert.equal(page.items.length, 24)
  assert.ok(page.nextCursor)

  const secondPage = await request(`/api/documents?limit=24&cursor=${encodeURIComponent(page.nextCursor)}`, { userId: 'user-a' })
  assert.equal((await secondPage.json()).items.length, 24)

  const search = await request('/api/documents?search=batch-paper-0.pdf&status=UPLOADED', { userId: 'user-a' })
  const searchResult = await search.json()
  assert.equal(searchResult.totalCount, 1)
  assert.equal(searchResult.items[0].fileName, 'batch-paper-0.pdf')

  const otherUserList = await request('/api/documents', { userId: 'user-b' })
  assert.equal((await otherUserList.json()).totalCount, 0)
})

test('returns only the owner’s metadata and PDF bytes and deletes both safely', async () => {
  const source = await makePdf(999)
  const created = await upload('user-a', 'private-paper.pdf', source)
  assert.equal(created.status, 201)
  const { document } = await created.json()

  const detail = await request(`/api/documents/${document.id}`, { userId: 'user-a' })
  assert.equal(detail.status, 200)
  assert.equal((await detail.json()).document.fileName, 'private-paper.pdf')

  const status = await request(`/api/documents/${document.id}/status`, { userId: 'user-a' })
  assert.equal((await status.json()).uploadStatus, 'UPLOADED')

  const file = await request(`/api/documents/${document.id}/file`, { userId: 'user-a' })
  assert.equal(file.status, 200)
  assert.match(file.headers.get('content-type'), /application\/pdf/)
  assert.equal(file.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), source)

  assert.equal((await request(`/api/documents/${document.id}`, { userId: 'user-b' })).status, 404)
  assert.equal((await request(`/api/documents/${document.id}/file`, { userId: 'user-b' })).status, 404)
  assert.equal((await request(`/api/documents/${document.id}`, { method: 'DELETE', userId: 'user-b' })).status, 404)

  const record = documents.get(document.id)
  const storageFile = path.join(storageDir, record.storageKey)
  assert.deepEqual(await readFile(storageFile), source)

  const deleted = await request(`/api/documents/${document.id}`, { method: 'DELETE', userId: 'user-a' })
  assert.equal(deleted.status, 204)
  assert.equal(documents.has(document.id), false)
  await assert.rejects(readFile(storageFile), { code: 'ENOENT' })
})

test('removes temporary files after rejected PDF parsing', async () => {
  const brokenPdf = Buffer.from('%PDF-1.7\nnot a valid cross-reference table\n%%EOF')
  await upload('user-a', 'bad-again.pdf', brokenPdf)
  const temporaryEntries = await readdir(path.join(storageDir, '.tmp'))
  assert.deepEqual(temporaryEntries, [])
})
