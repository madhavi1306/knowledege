export class ApiError extends Error {
  constructor(message, status, issues = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.issues = issues
  }
}

export async function apiRequest(path, options = {}) {
  let response
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('We could not reach KNOWFLOW. Check that the backend is running and try again.', 0)
  }

  if (response.status === 204) return null

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(payload.error || 'Something went wrong. Please try again.', response.status, payload.issues || [])
  }
  return payload
}
