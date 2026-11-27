import { motion } from 'framer-motion'
import { AlertCircle, Check, FileText, LoaderCircle, RotateCcw, UploadCloud, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MAX_PDF_SIZE_MB, uploadDocument } from '../services/documents.js'

const MAX_FILE_SIZE = MAX_PDF_SIZE_MB * 1024 * 1024
const PDF_MIME_TYPES = new Set(['', 'application/pdf', 'application/octet-stream'])

function readableSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function makeQueueEntry(file) {
  let error = ''
  if (!file.name.toLowerCase().endsWith('.pdf')) error = 'This file does not have a PDF filename.'
  else if (!PDF_MIME_TYPES.has(file.type)) error = 'The selected file type is not a PDF.'
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

function queueStatus(entry) {
  if (entry.status === 'queued') return 'Waiting'
  if (entry.status === 'uploading') return entry.progress >= 100 ? 'Checking PDF' : `Uploading ${entry.progress}%`
  if (entry.status === 'uploaded') return 'Uploaded'
  if (entry.status === 'duplicate') return 'Already added'
  if (entry.status === 'cancelled') return 'Cancelled'
  return 'Upload failed'
}

export default function UploadDialog({ onClose, onUploaded }) {
  const [queue, setQueue] = useState([])
  const [processing, setProcessing] = useState(false)
  const [dragging, setDragging] = useState(false)
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
    if (entries.length) updateQueue((current) => [...current, ...entries])
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
          const cancelled = error.name === 'AbortError'
          updateQueue((current) => current.map((entry) => (
            entry.id === nextEntry.id
              ? {
                  ...entry,
                  status: cancelled ? 'cancelled' : duplicate ? 'duplicate' : 'failed',
                  error: cancelled ? '' : error.message,
                  retryable: !cancelled && !duplicate && (error.status === 0 || error.status >= 500),
                }
              : entry
          )))
        } finally {
          activeUploads.current.delete(nextEntry.id)
        }
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(2, queuedCount) }, () => worker()))
    } finally {
      processingRef.current = false
      setProcessing(false)
      if (uploadedAny) onUploaded()
    }
  }

  function cancelEntry(id) {
    const upload = activeUploads.current.get(id)
    if (upload) upload.abort()
    updateQueue((current) => current.map((entry) => (
      entry.id === id && entry.status !== 'uploaded'
        ? { ...entry, status: 'cancelled', error: '', retryable: false }
        : entry
    )))
  }

  function retryEntry(id) {
    updateQueue((current) => current.map((entry) => (
      entry.id === id
        ? { ...entry, status: 'queued', progress: 0, error: '', retryable: false }
        : entry
    )))
    if (processingRef.current) return
    window.setTimeout(startUploads, 0)
  }

  const progressEntries = queue.filter((entry) => !(entry.status === 'failed' && !entry.retryable))
  const totalBytes = progressEntries.reduce((total, entry) => total + entry.file.size, 0)
  const transferredBytes = progressEntries.reduce((total, entry) => (
    total + entry.file.size * (entry.status === 'uploaded' ? 1 : entry.progress / 100)
  ), 0)
  const overallProgress = totalBytes ? Math.round((transferredBytes / totalBytes) * 100) : 0
  const queuedCount = queue.filter((entry) => entry.status === 'queued').length
  const uploadedCount = queue.filter((entry) => entry.status === 'uploaded').length
  const uploadableCount = progressEntries.length
  const hasWork = queue.some((entry) => ['queued', 'uploading'].includes(entry.status))

  return (
    <div
      className="upload-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (!processing && event.target === event.currentTarget) onClose()
      }}
    >
      <motion.section
        className="upload-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-dialog-title"
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{ duration: 0.2 }}
      >
        <div className="upload-modal-heading">
          <div className="upload-modal-title">
            <span className="upload-modal-icon"><UploadCloud size={19} /></span>
            <div><h2 id="upload-dialog-title">Add papers</h2><p>Select one or more PDFs to add to your library.</p></div>
          </div>
          <button className="icon-button upload-modal-close" onClick={onClose} disabled={processing} aria-label="Close upload dialog"><X size={19} /></button>
        </div>

        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={(event) => {
            addFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <button
          className={`upload-dropzone${dragging ? ' upload-dropzone-active' : ''}`}
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            addFiles(event.dataTransfer.files)
          }}
        >
          <span className="dropzone-art"><UploadCloud size={24} /></span>
          <strong>Drop your PDFs here, or <span>browse files</span></strong>
          <small>Multiple files welcome · no document-count limit · up to {MAX_PDF_SIZE_MB} MB each</small>
        </button>

        {queue.length > 0 && (
          <div className="upload-queue-section">
            <div className="upload-queue-heading">
              <div><strong>Upload queue</strong><span>{queue.length} {queue.length === 1 ? 'file' : 'files'}</span></div>
              <button
                type="button"
                className="text-button"
                disabled={processing}
                onClick={() => updateQueue([])}
              >
                Clear list
              </button>
            </div>
            <div className="upload-overall">
              <div className="upload-overall-label"><span>{uploadedCount} of {uploadableCount} uploaded</span><b>{overallProgress}%</b></div>
              <div className="upload-progress-track"><i style={{ width: `${overallProgress}%` }} /></div>
            </div>
            <div className="upload-queue-list">
              {queue.map((entry) => (
                <article className={`upload-queue-item upload-item-${entry.status}`} key={entry.id}>
                  <span className="queue-file-icon"><FileText size={17} /></span>
                  <div className="queue-file-info">
                    <strong title={entry.file.name}>{entry.file.name}</strong>
                    <span>{readableSize(entry.file.size)} · {queueStatus(entry)}</span>
                    {entry.status === 'uploading' && <i className="queue-item-progress" style={{ width: `${entry.progress}%` }} />}
                    {entry.error && <small className="queue-item-error"><AlertCircle size={12} />{entry.error}</small>}
                  </div>
                  {entry.status === 'uploaded' && <Check className="queue-item-check" size={17} />}
                  {entry.status === 'uploading' && <button className="icon-button queue-item-action" onClick={() => cancelEntry(entry.id)} aria-label={`Cancel ${entry.file.name}`}><X size={16} /></button>}
                  {(entry.status === 'queued' || entry.status === 'failed') && !entry.retryable && entry.status === 'queued' && (
                    <button className="icon-button queue-item-action" onClick={() => cancelEntry(entry.id)} aria-label={`Remove ${entry.file.name} from queue`}><X size={16} /></button>
                  )}
                  {entry.retryable && <button className="icon-button queue-item-retry" onClick={() => retryEntry(entry.id)} aria-label={`Retry ${entry.file.name}`}><RotateCcw size={15} /></button>}
                  {(entry.status === 'duplicate' || entry.status === 'cancelled' || (entry.status === 'failed' && !entry.retryable)) && (
                    <span className="queue-item-dismiss" aria-hidden="true"><X size={15} /></span>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="upload-modal-footer">
          <span className="upload-limit-note">{queue.length ? `${queue.filter((entry) => entry.status === 'uploaded').length} uploaded in this session` : 'Your files stay private to your account.'}</span>
          <div>
            <button type="button" className="button button-outline" onClick={onClose} disabled={processing}>Close</button>
            <button type="button" className="button button-primary" onClick={startUploads} disabled={!queuedCount || processing}>
              {processing ? <><LoaderCircle className="spin" size={15} /> Uploading…</> : <>Upload {queuedCount ? `${queuedCount} ${queuedCount === 1 ? 'PDF' : 'PDFs'}` : 'PDFs'}</>}
            </button>
          </div>
        </div>
        {hasWork && <p className="upload-queue-hint">Uploads run two files at a time; the rest wait safely in the queue.</p>}
      </motion.section>
    </div>
  )
}
