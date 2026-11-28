import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../pdf_processor/extract_pdf.py',
)

function resolvePythonExecutable() {
  const envVal = process.env.PYTHON_EXECUTABLE
  if (envVal && existsSync(envVal)) return envVal
  const candidates = [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Python', 'bin', 'python.exe') : null,
    'C:\\Users\\Admin\\AppData\\Local\\Python\\bin\\python.exe',
  ].filter(Boolean)
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return envVal || 'python'
}

function runExtractor(executable, pdfPath, outputPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [SCRIPT_PATH, pdfPath, outputPath], {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    let settled = false
    const timeout = setTimeout(() => {
      child.kill()
      fail(new Error('PDF extraction timed out. The document may be too complex to process.'))
    }, timeoutMs)

    function finish(callback, value) {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      callback(value)
    }

    function fail(error) {
      finish(reject, error)
    }

    child.stderr.on('data', (chunk) => {
      if (stderr.length < 4096) stderr += chunk.toString().slice(0, 4096 - stderr.length)
    })
    child.once('error', () => {
      fail(new Error('Could not start Python PDF extraction. Check Python and PyMuPDF setup.'))
    })
    child.once('close', (code) => {
      if (code === 0) return finish(resolve)
      if (stderr) console.error('PDF extraction process failed.', stderr)
      fail(new Error('PDF text extraction failed. Check that the PDF can be read.'))
    })
  })
}

export async function extractPdfPages(pdfPath, settings = {}) {
  const storageDir = settings.storageDir
  const temporaryDirectory = path.join(storageDir, '.tmp')
  const outputPath = path.join(temporaryDirectory, `${randomUUID()}.pages.json`)
  const executable = resolvePythonExecutable()
  const timeoutMs = Number(process.env.PDF_EXTRACTION_TIMEOUT_MS || 300000)

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000) {
    throw new Error('PDF_EXTRACTION_TIMEOUT_MS must be at least 1000 milliseconds.')
  }

  await mkdir(temporaryDirectory, { recursive: true })
  try {
    await runExtractor(executable, pdfPath, outputPath, timeoutMs)
    const result = JSON.parse(await readFile(outputPath, 'utf8'))
    if (!Array.isArray(result.pages) || result.pageCount !== result.pages.length) {
      throw new Error('The PDF processor returned an invalid page structure.')
    }
    return result
  } finally {
    await rm(outputPath, { force: true })
  }
}
