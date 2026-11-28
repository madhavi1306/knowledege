import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createApp } from '../src/app.js'
import { FileStoreError, FileStoreRepository } from '../src/utils/file-store.js'

process.env.JWT_SECRET ||= 'knowflow-file-store-tests-use-a-long-secret'
process.env.NODE_ENV = 'test'

test('registration persists to the JSON fallback and survives a repository restart', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'knowflow-register-'))
  const storePath = path.join(directory, 'db.json')
  const server = createApp(new FileStoreRepository(storePath)).listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Taylor Learner',
        email: 'learner@example.com',
        password: 'Test-only-password-41',
      }),
    })
    assert.equal(response.status, 201)
    const { user } = await response.json()
    assert.equal(user.email, 'learner@example.com')

    const restartedStore = new FileStoreRepository(storePath)
    const persistedUser = await restartedStore.user.findUnique({ where: { email: user.email } })
    assert.equal(persistedUser.id, user.id)
    assert.equal(typeof persistedUser.passwordHash, 'string')
  } finally {
    server.close()
    await once(server, 'close')
    await rm(directory, { recursive: true, force: true })
  }
})

test('invalid JSON storage is reported without overwriting existing bytes', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'knowflow-store-corrupt-'))
  const storePath = path.join(directory, 'db.json')
  const original = '{ invalid data'
  try {
    await writeFile(storePath, original, 'utf8')
    const store = new FileStoreRepository(storePath)
    await assert.rejects(
      store.user.findUnique({ where: { email: 'learner@example.com' } }),
      FileStoreError,
    )
    assert.equal(await readFile(storePath, 'utf8'), original)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
