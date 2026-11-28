import { ApiError } from './api.js'

const configuredMax = Number(import.meta.env.VITE_MAX_PDF_SIZE_MB || 50)
export const MAX_PDF_SIZE_MB = Number.isSafeInteger(configuredMax) && configuredMax > 0 ? configuredMax : 50

export function uploadDocument(file, onProgress) {
  const xhr = new XMLHttpRequest()
  const form = new FormData()
  form.append('file', file, file.name)

  const promise = new Promise((resolve, reject) => {
    xhr.open('POST', '/api/documents/upload')
    xhr.withCredentials = true
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })
    xhr.addEventListener('load', () => {
      const payload = (() => {
        try { return JSON.parse(xhr.responseText) } catch { return {} }
      })()
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload.document)
      } else {
        reject(new ApiError(payload.error || 'This PDF could not be uploaded.', xhr.status))
      }
    })
    xhr.addEventListener('error', () => {
      reject(new ApiError('The upload connection was interrupted. Try this file again.', 0))
    })
    xhr.addEventListener('abort', () => {
      const error = new Error('Upload cancelled.')
      error.name = 'AbortError'
      reject(error)
    })
    xhr.send(form)
  })

  return { promise, abort: () => xhr.abort() }
}

export async function uploadRawText(title, content) {
  const res = await fetch('/api/documents/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title, content }),
  })
  const data = await res.json()
  if (!res.ok) throw new ApiError(data.error || 'Failed to save text material.', res.status)
  return data.document
}

export async function uploadUrl(url, title) {
  const res = await fetch('/api/documents/url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ url, title }),
  })
  const data = await res.json()
  if (!res.ok) throw new ApiError(data.error || 'Failed to import web article.', res.status)
  return data.document
}
