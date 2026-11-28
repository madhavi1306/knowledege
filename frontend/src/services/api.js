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
  const hasBody = options.body !== undefined && options.body !== null
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const shouldStringify = hasBody && !isFormData && typeof options.body !== 'string'
  const body = shouldStringify ? JSON.stringify(options.body) : options.body

  const headers = {
    ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  }

  try {
    response = await fetch(path, {
      ...options,
      body,
      credentials: 'same-origin',
      headers,
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
