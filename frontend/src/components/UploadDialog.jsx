import { motion } from 'framer-motion'
import { AlertCircle, Check, FileText, Globe, LoaderCircle, PenTool, RotateCcw, UploadCloud, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MAX_PDF_SIZE_MB, uploadDocument, uploadRawText, uploadUrl } from '../services/documents.js'

const MAX_FILE_SIZE = MAX_PDF_SIZE_MB * 1024 * 1024
const PDF_MIME_TYPES = new Set(['', 'application/pdf', 'application/octet-stream'])

function readableSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function makeQueueEntry(file) {
  let error = ''
  const isPdfName = file.name.toLowerCase().endsWith('.pdf')
  const isPdfType = !file.type || file.type.toLowerCase().includes('pdf') || file.type === 'application/octet-stream'
  if (!isPdfName && !isPdfType) error = 'The selected file is not a PDF.'
  else if (file.size === 0) error = 'This file is empty.'
  else if (file.size > MAX_FILE_SIZE) error = `This PDF is over the ${MAX_PDF_SIZE_MB} MB per-file limit.`

  return {
    id: crypto.randomUUID(),
    file,
    status: error ? 'failed' : 'queued',
    progress: 0,
    error,
    retryable: false,
  }
}

export default function UploadDialog({ onClose, onUploaded }) {
  const [activeTab, setActiveTab] = useState('pdf') // 'pdf', 'text', 'url'
  const [queue, setQueue] = useState([])
  const [processing, setProcessing] = useState(false)
  const [dragging, setDragging] = useState(false)

  // Raw text state
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [textSubmitting, setTextSubmitting] = useState(false)
  const [textError, setTextError] = useState('')

  // URL state
  const [webUrl, setWebUrl] = useState('')
  const [urlTitle, setUrlTitle] = useState('')
  const [urlSubmitting, setUrlSubmitting] = useState(false)
  const [urlError, setUrlError] = useState('')

  const queueRef = useRef([])
  const activeUploads = useRef(new Map())
  const processingRef = useRef(false)
  const inputRef = useRef(null)

  function updateQueue(update) {
    const next = update(queueRef.current)
    queueRef.current = next
    setQueue(next)
  }

  useEffect(() => () => {
    for (const upload of activeUploads.current.values()) upload.abort()
  }, [])

  function addFiles(fileList) {
    const entries = Array.from(fileList).map(makeQueueEntry)
    if (entries.length) {
      updateQueue((current) => [...current, ...entries])
      setTimeout(() => {
        startUploads()
      }, 60)
    }
  }

  async function startUploads() {
    if (processingRef.current) return
    const queuedCount = queueRef.current.filter((entry) => entry.status === 'queued').length
    if (!queuedCount) return

    processingRef.current = true
    setProcessing(true)
    let uploadedAny = false

    async function worker() {
      while (true) {
        const nextEntry = queueRef.current.find((entry) => entry.status === 'queued')
        if (!nextEntry) return

        updateQueue((current) => current.map((entry) => (
          entry.id === nextEntry.id ? { ...entry, status: 'uploading', progress: 0, error: '' } : entry
        )))
        const upload = uploadDocument(nextEntry.file, (progress) => {
          updateQueue((current) => current.map((entry) => (
            entry.id === nextEntry.id && entry.status === 'uploading'
              ? { ...entry, progress }
              : entry
          )))
        })
        activeUploads.current.set(nextEntry.id, upload)

        try {
          await upload.promise
          uploadedAny = true
          updateQueue((current) => current.map((entry) => (
            entry.id === nextEntry.id ? { ...entry, status: 'uploaded', progress: 100 } : entry
          )))
        } catch (error) {
          const duplicate = error.status === 409
          updateQueue((current) => current.map((entry) => (
            entry.id === nextEntry.id
              ? {
                ...entry,
                status: duplicate ? 'duplicate' : 'failed',
                error: duplicate ? 'Already in your library.' : error.message,
                retryable: !duplicate,
              }
              : entry
          )))
        } finally {
          activeUploads.current.delete(nextEntry.id)
        }
      }
    }

    await Promise.all([worker(), worker()])
    processingRef.current = false
    setProcessing(false)
    if (uploadedAny) onUploaded?.()
  }

  async function handleTextSubmit(e) {
    e.preventDefault()
    if (!textContent.trim()) {
      setTextError('Please enter text content to internalize.')
      return
    }
    setTextSubmitting(true)
    setTextError('')
    try {
      await uploadRawText(textTitle || 'Pasted Notes', textContent)
      onUploaded?.()
      onClose()
    } catch (err) {
      setTextError(err.message)
    } finally {
      setTextSubmitting(false)
    }
  }

  async function handleUrlSubmit(e) {
    e.preventDefault()
    if (!webUrl.trim()) {
      setUrlError('Please enter a website URL.')
      return
    }
    setUrlSubmitting(true)
    setUrlError('')
    try {
      await uploadUrl(webUrl, urlTitle)
      onUploaded?.()
      onClose()
    } catch (err) {
      setUrlError(err.message)
    } finally {
      setUrlSubmitting(false)
    }
  }

  return (
    <div className="upload-dialog-overlay" onClick={onClose}>
      <motion.div
        className="upload-dialog-card"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="dialog-header">
          <div>
            <h3>Add Learning Material</h3>
            <p>Ingest textbooks, lecture notes, or web articles to build your knowledge graph.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="upload-tabs">
          <button
            type="button"
            className={`upload-tab-btn ${activeTab === 'pdf' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('pdf')}
          >
            <UploadCloud size={16} /> Upload PDFs
          </button>
          <button
            type="button"
            className={`upload-tab-btn ${activeTab === 'text' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            <PenTool size={16} /> Paste Raw Text
          </button>
          <button
            type="button"
            className={`upload-tab-btn ${activeTab === 'url' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('url')}
          >
            <Globe size={16} /> Web Article URL
          </button>
        </div>

        {activeTab === 'pdf' && (
          <div className="tab-content">
            <div
              className={`dropzone ${dragging ? 'is-dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
              }}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <UploadCloud size={36} className="dropzone-icon" />
              <strong>Drag & drop PDF files here, or click to browse</strong>
              <span>Supports multiple files up to {MAX_PDF_SIZE_MB}MB each</span>
            </div>

            {queue.length > 0 && (
              <div className="queue-list">
                {queue.map((item) => (
                  <div key={item.id} className={`queue-item queue-${item.status}`}>
                    <FileText size={16} />
                    <div className="flex-1 min-w-0" style={{ margin: '0 8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="file-name" style={{ fontWeight: 500, fontSize: '0.85rem' }}>{item.file.name}</span>
                        <span className="file-size" style={{ fontSize: '0.75rem', opacity: 0.7 }}>{readableSize(item.file.size)}</span>
                      </div>
                      {item.status === 'uploading' && (
                        <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '999px', marginTop: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: 'var(--brand-600, #3b82f6)', width: `${item.progress}%`, transition: 'width 0.2s ease' }} />
                        </div>
                      )}
                      {item.error && <span style={{ color: '#ef4444', fontSize: '0.75rem', display: 'block', marginTop: '2px' }}>{item.error}</span>}
                    </div>
                    <span className="file-status" style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                      {item.status === 'uploading' ? `${item.progress}%` : item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="dialog-actions">
              {queue.length > 0 && queue.every((e) => e.status === 'uploaded' || e.status === 'duplicate') ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    onUploaded?.()
                    onClose()
                  }}
                >
                  <Check size={16} /> Done
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={processing || !queue.some((e) => e.status === 'queued')}
                    onClick={startUploads}
                  >
                    {processing ? <><LoaderCircle className="animate-spin" size={16} /> Processing...</> : 'Upload Now'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'text' && (
          <form className="tab-content" onSubmit={handleTextSubmit}>
            <div className="form-group">
              <label>Topic / Document Title</label>
              <input
                type="text"
                placeholder="e.g. Distributed Consensus Notes"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Raw Study Material (Text)</label>
              <textarea
                rows={7}
                placeholder="Paste book chapters, lecture transcripts, definitions, or articles..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="form-textarea"
                required
              />
            </div>
            {textError && <div className="form-error"><AlertCircle size={15} /> {textError}</div>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={textSubmitting}>
                {textSubmitting ? <><LoaderCircle className="animate-spin" size={16} /> Ingesting...</> : 'Save & Internalize'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'url' && (
          <form className="tab-content" onSubmit={handleUrlSubmit}>
            <div className="form-group">
              <label>Website / Article URL</label>
              <input
                type="url"
                placeholder="https://example.com/article-or-tutorial"
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label>Optional Custom Title</label>
              <input
                type="text"
                placeholder="e.g. React 19 Architecture Guide"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                className="form-input"
              />
            </div>
            {urlError && <div className="form-error"><AlertCircle size={15} /> {urlError}</div>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={urlSubmitting}>
                {urlSubmitting ? <><LoaderCircle className="animate-spin" size={16} /> Fetching & Parsing...</> : 'Import & Internalize'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  )
}
