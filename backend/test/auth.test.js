import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'

process.env.JWT_SECRET = 'test-only-secret-for-knowflow-auth-suite'
process.env.NODE_ENV = 'test'

let server
let baseUrl
let users

function createTestPrisma() {
  return {
    user: {
      async create({ data }) {
        if ([...users.values()].some((user) => user.email === data.email)) {
          const error = new Error('Unique constraint')
          error.code = 'P2002'
          throw error
        }
        const now = new Date()
        const user = { id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now }
        users.set(user.id, user)
        return user
      },
      async findUnique({ where }) {
        if (where.id) return users.get(where.id) ?? null
        return [...users.values()].find((user) => user.email === where.email) ?? null
      },
      async update({ where, data }) {
        if ([...users.values()].some((user) => user.id !== where.id && user.email === data.email)) {
          const error = new Error('Unique constraint')
          error.code = 'P2002'
          throw error
        }
        const user = { ...users.get(where.id), ...data, updatedAt: new Date() }
        users.set(user.id, user)
        return user
      },
    },
  }
}

async function request(path, { method = 'GET', body, cookie } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

async function register(email = 'learner@example.com') {
  return request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Taylor Learner', email, password: 'Test-only-password-41' },
  })
}

before(async () => {
  users = new Map()
  server = createApp(createTestPrisma()).listen(0, '127.0.0.1')
  await once(server, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) {
    server.close()
    await once(server, 'close')
  }
})

test('registration validates input, hashes passwords, and rejects duplicate emails', async () => {
  const invalid = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'T', email: 'not-an-email', password: 'short' },
  })
  assert.equal(invalid.status, 400)

  const created = await register('Learner@Example.com')
  assert.equal(created.status, 201)
  const { user } = await created.json()
  assert.equal(user.email, 'learner@example.com')
  assert.equal('passwordHash' in user, false)
  const sessionCookie = created.headers.get('set-cookie')
  assert.match(sessionCookie, /HttpOnly/i)
  assert.match(sessionCookie, /SameSite=Lax/i)

  const duplicate = await register('learner@example.com')
  assert.equal(duplicate.status, 409)
})

test('login rejects incorrect passwords and returns a protected session for valid credentials', async () => {
  await register('login@example.com')

  const invalidLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'login@example.com', password: 'wrong-password' },
  })
  assert.equal(invalidLogin.status, 401)

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'LOGIN@example.com', password: 'Test-only-password-41' },
  })
  assert.equal(login.status, 200)
  const cookie = login.headers.get('set-cookie').split(';')[0]
  const me = await request('/api/auth/me', { cookie })
  assert.equal(me.status, 200)
  assert.equal((await me.json()).user.email, 'login@example.com')
})

test('profile routes require a session and update only the signed-in user', async () => {
  const unauthenticated = await request('/api/profile')
  assert.equal(unauthenticated.status, 401)

  const created = await register('profile@example.com')
  const cookie = created.headers.get('set-cookie').split(';')[0]
  const profile = await request('/api/profile', { cookie })
  assert.equal(profile.status, 200)

  const update = await request('/api/profile', {
    method: 'PUT',
    cookie,
    body: { name: 'Taylor Updated', email: 'updated@example.com' },
  })
  assert.equal(update.status, 200)
  assert.equal((await update.json()).user.name, 'Taylor Updated')

  const passwordMismatch = await request('/api/profile', {
    method: 'PUT',
    cookie,
    body: { currentPassword: 'incorrect', newPassword: 'New-test-password-82' },
  })
  assert.equal(passwordMismatch.status, 400)

  const passwordUpdate = await request('/api/profile', {
    method: 'PUT',
    cookie,
    body: { currentPassword: 'Test-only-password-41', newPassword: 'New-test-password-82' },
  })
  assert.equal(passwordUpdate.status, 200)
})

test('logout clears the session cookie and protected routes reject it afterwards', async () => {
  const created = await register('logout@example.com')
  const cookie = created.headers.get('set-cookie').split(';')[0]
  const logout = await request('/api/auth/logout', { method: 'POST', cookie })
  assert.equal(logout.status, 204)
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/)
  const afterLogout = await request('/api/profile', { cookie: '' })
  assert.equal(afterLogout.status, 401)
})
