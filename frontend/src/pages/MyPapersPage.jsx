import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowDownToLine,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCheck,
  Edit2,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  Video,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import { MAX_PDF_SIZE_MB, uploadDocument } from '../services/documents.js'

const PAGE_SIZE = 24
const MAX_FILE_SIZE = MAX_PDF_SIZE_MB * 1024 * 1024

const statusLabels = {
  UPLOADED: 'Uploaded',
  PROCESSING: 'Processing',
  ANALYSIS_COMPLETED: 'Analysis complete',
  FAILED: 'Failed',
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function DocumentCard({ document, onDetails, onDelete, onRename, deleting, selected, onSelect }) {
  const status = statusLabels[document.uploadStatus] || 'Uploaded'
  const selectable = ['UPLOADED', 'FAILED'].includes(document.uploadStatus)

  return (
    <motion.article
      className="paper-card"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18 }}
    >
      <div className="paper-card-main">
        {selectable && (
          <label className="paper-select">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onSelect(document.id)}
              aria-label={`Select ${document.fileName}`}
            />
          </label>
        )}
        <span className="paper-file-icon"><FileText size={22} strokeWidth={1.8} /><small>PDF</small></span>
        <div className="paper-card-copy">
          <a className="paper-card-title" href={`/api/documents/${encodeURIComponent(document.id)}/file`} target="_blank" rel="noopener noreferrer" title={`Open ${document.fileName}`}>
            {document.fileName}
          </a>
          <div className="paper-card-metadata">
            <span>{formatSize(document.fileSize)}</span><i />
            <span>Added {formatDate(document.uploadedAt)}</span>
          </div>
        </div>
        <span className={`document-status status-${document.uploadStatus.toLowerCase()}`}>
          <i />{status}
        </span>
      </div>

      <div className="paper-card-footer">
        <span className="paper-card-type"><FolderOpen size={13} /> Personal papers</span>
        <div className="paper-card-actions flex-wrap gap-1">
          {/* 1. Learn (Structured Notes) */}
          <Link
            to={`/app/papers/${encodeURIComponent(document.id)}/learn`}
            className="paper-action-button"
            style={{ fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '4px 8px', borderRadius: '6px' }}
            title="Study with 12-element structured AI notes"
          >
            <BookOpen size={13} /> Learn
          </Link>

          {/* 2. Visuals (Diagrams & Flowcharts) */}
          <Link
            to={`/app/papers/${encodeURIComponent(document.id)}/visuals`}
            className="paper-action-button"
            style={{ fontWeight: 600, color: '#7c3aed', background: '#f5f3ff', padding: '4px 8px', borderRadius: '6px' }}
            title="Explore diagrams, maps, and visual explanations"
          >
            <ImageIcon size={13} /> Visuals
          </Link>

          {/* 3. Ask AI (Document Chat) */}
          <Link
            to={`/app/papers/${encodeURIComponent(document.id)}/chat`}
            className="paper-action-button"
            style={{ fontWeight: 600, color: '#4f46e5', background: '#eef2ff', padding: '4px 8px', borderRadius: '6px' }}
            title="Ask questions grounded in this paper"
          >
            <MessageSquare size={13} /> Ask AI
          </Link>

          {/* 4. Test (Assessment) */}
          <Link
            to={`/app/papers/${encodeURIComponent(document.id)}/test`}
            className="paper-action-button"
            style={{ fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '4px 8px', borderRadius: '6px' }}
            title="Take topic-wise assessment tests"
          >
            <ClipboardCheck size={13} /> Test
          </Link>

          {/* 5. Revise (Adaptive Weak Topics) */}
          <Link
            to={`/app/papers/${encodeURIComponent(document.id)}/adaptive`}
            className="paper-action-button"
            style={{ fontWeight: 600, color: '#e11d48', background: '#fff1f2', padding: '4px 8px', borderRadius: '6px' }}
            title="Revise weak topics and take adaptive retests"
          >
            <RotateCcw size={13} /> Revise
          </Link>

          {/* 6. Open Original PDF */}
          <a
            className="paper-action-button"
            href={`/api/documents/${encodeURIComponent(document.id)}/file`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open original PDF in new tab"
          >
            <ArrowDownToLine size={13} /> PDF
          </a>

          {/* 7. Rename */}
          <button
            type="button"
            className="paper-action-button"
            onClick={() => onRename(document)}
            title="Rename document title"
          >
            <Edit2 size={13} /> Rename
          </button>

          {/* 8. Details */}
          <button
            type="button"
            className="paper-action-button"
            onClick={() => onDetails(document.id)}
            title="View document metadata"
          >
            <Info size={13} /> Info
          </button>

          {/* 9. Delete */}
          <button
            type="button"
            className="paper-action-button paper-delete-button"
            onClick={() => onDelete(document)}
            disabled={deleting}
            title="Delete from your library"
          >
            {deleting ? <LoaderCircle className="spin" size={13} /> : <Trash2 size={13} />}
            Delete
          </button>
        </div>
      </div>
    </motion.article>
  )
}

function DocumentDetails({ document, onClose }) {
  if (!document) return null

  return (
    <div className="detail-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="document-details-title">
        <div className="detail-modal-heading">
          <div className="detail-modal-icon"><FileText size={20} /></div>
          <button className="icon-button" onClick={onClose} aria-label="Close document details"><X size={18} /></button>
        </div>
        <span className="eyebrow">PAPER DETAILS</span>
        <h2 id="document-details-title">{document.fileName}</h2>
        <p className="detail-modal-subtitle">A PDF in your private KNOWFLOW library.</p>
        <dl className="document-detail-list">
          <div><dt>File size</dt><dd>{formatSize(document.fileSize)}</dd></div>
          <div><dt>File type</dt><dd>{document.mimeType}</dd></div>
          <div><dt>Added</dt><dd>{formatDate(document.uploadedAt)}</dd></div>
          <div><dt>Upload status</dt><dd><span className={`document-status status-${document.uploadStatus.toLowerCase()}`}><i />{statusLabels[document.uploadStatus] || 'Uploaded'}</span></dd></div>
          <div><dt>Original file name</dt><dd className="document-original-name">{document.originalFileName}</dd></div>
        </dl>
        <div className="flex gap-2 mt-4">
          <a className="button button-primary detail-open-button" href={`/api/documents/${encodeURIComponent(document.id)}/file`} target="_blank" rel="noopener noreferrer">
            <ArrowDownToLine size={15} /> Open PDF
          </a>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  )
}

export default function MyPapersPage() {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [details, setDetails] = useState(null)
  const [detailsError, setDetailsError] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [batchAnalyzing, setBatchAnalyzing] = useState(false)
  const [batchMessage, setBatchMessage] = useState('')

  // Real Direct Upload State (No clunky modal needed)
  const [uploadQueue, setUploadQueue] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const fileInputRef = useRef(null)

  // URL / Video Link Import State
  const [showUrlModal, setShowUrlModal] = useState(false)
  const [inputUrl, setInputUrl] = useState('')
  const [inputTitle, setInputTitle] = useState('')
  const [submittingUrl, setSubmittingUrl] = useState(false)
  const [urlError, setUrlError] = useState('')

  async function handleImportUrl(e) {
    e?.preventDefault()
    if (!inputUrl.trim()) return
    setSubmittingUrl(true)
    setUrlError('')
    try {
      const res = await apiRequest('/api/documents/url', {
        method: 'POST',
        body: { url: inputUrl.trim(), title: inputTitle.trim() || undefined },
      })
      setBatchMessage(`Successfully imported: ${res.document?.fileName || 'URL resource'}`)
      setShowUrlModal(false)
      setInputUrl('')
      setInputTitle('')
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setUrlError(err.message || 'Failed to import URL or video.')
    } finally {
      setSubmittingUrl(false)
    }
  }

  async function handleSeedSamples() {
    setSeeding(true)
    setError('')
    try {
      const res = await apiRequest('/api/documents/seed-samples', { method: 'POST' })
      setBatchMessage(`Loaded ${res.count || 10} curated academic & research papers into your library!`)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err.message || 'Failed to load sample papers.')
    } finally {
      setSeeding(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      setDocuments([])
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
      if (search.trim()) params.set('search', search.trim())
      if (status) params.set('status', status)
      try {
        const result = await apiRequest(`/api/documents?${params}`, { signal: controller.signal })
        setDocuments(result.items)
        setTotalCount(result.totalCount)
        setNextCursor(result.nextCursor)
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, search ? 220 : 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search, status, refreshKey])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setError('')
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), cursor: nextCursor })
    if (search.trim()) params.set('search', search.trim())
    if (status) params.set('status', status)
    try {
      const result = await apiRequest(`/api/documents?${params}`)
      setDocuments((current) => [...current, ...result.items])
      setNextCursor(result.nextCursor)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoadingMore(false)
    }
  }

  // Handle direct file uploads from the blue button or drag-and-drop
  async function handleFilesSelected(fileList) {
    if (!fileList || !fileList.length) return
    setError('')
    const files = Array.from(fileList)

    const newEntries = files.map((file) => {
      let fileError = ''
      const isPdfName = file.name.toLowerCase().endsWith('.pdf')
      const isPdfType = !file.type || file.type.toLowerCase().includes('pdf') || file.type === 'application/octet-stream'
      if (!isPdfName && !isPdfType) fileError = 'Only PDF files can be uploaded.'
      else if (file.size === 0) fileError = 'This file is empty.'
      else if (file.size > MAX_FILE_SIZE) fileError = `Over ${MAX_PDF_SIZE_MB}MB limit.`

      return {
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        status: fileError ? 'failed' : 'uploading',
        progress: 0,
        error: fileError,
      }
    })

    setUploadQueue((prev) => [...newEntries, ...prev])

    // Process valid files
    for (const entry of newEntries) {
      if (entry.status === 'failed') continue

      const upload = uploadDocument(entry.file, (progress) => {
        setUploadQueue((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, progress } : e))
        )
      })

      try {
        await upload.promise
        setUploadQueue((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, status: 'uploaded', progress: 100 } : e))
        )
        refreshDocuments()
      } catch (err) {
        const isDuplicate = err.status === 409
        setUploadQueue((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? {
                  ...e,
                  status: isDuplicate ? 'duplicate' : 'failed',
                  error: isDuplicate ? 'Already in your library.' : err.message,
                }
              : e
          )
        )
      }
    }
  }

  function dismissQueueItem(id) {
    setUploadQueue((prev) => prev.filter((e) => e.id !== id))
  }

  async function showDetails(id) {
    setDetailsError('')
    try {
      const result = await apiRequest(`/api/documents/${encodeURIComponent(id)}`)
      setDetails(result.document)
    } catch (requestError) {
      setDetailsError(requestError.message)
    }
  }

  async function renameDocument(document) {
    const currentName = document.fileName.replace(/\.pdf$/i, '')
    const newName = window.prompt('Enter new title for this document:', currentName)
    if (!newName || !newName.trim() || newName.trim() === currentName) return
    setError('')
    try {
      await apiRequest(`/api/documents/${encodeURIComponent(document.id)}`, {
        method: 'PATCH',
        body: { title: newName.trim() },
      })
      refreshDocuments()
      if (details?.id === document.id) {
        showDetails(document.id)
      }
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function deleteDocument(document) {
    const confirmed = window.confirm(`Delete "${document.fileName}" from your papers? This cannot be undone.`)
    if (!confirmed) return
    setDeletingId(document.id)
    setError('')
    try {
      await apiRequest(`/api/documents/${encodeURIComponent(document.id)}`, { method: 'DELETE' })
      setRefreshKey((current) => current + 1)
      setSelectedIds((current) => current.filter((id) => id !== document.id))
      if (details?.id === document.id) setDetails(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDeletingId('')
    }
  }

  function refreshDocuments() {
    setRefreshKey((current) => current + 1)
  }

  function toggleSelected(id) {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ))
  }

  async function startBatchAnalysis() {
    if (!selectedIds.length || batchAnalyzing) return
    const documentIds = [...selectedIds]
    setBatchAnalyzing(true)
    setError('')
    setBatchMessage('')
    try {
      await apiRequest('/api/analysis/batch', {
        method: 'POST',
        body: { documentIds },
      })
      setSelectedIds([])
      setBatchMessage(`Analysis started for ${documentIds.length} ${documentIds.length === 1 ? 'paper' : 'papers'}.`)
      setRefreshKey((current) => current + 1)
      navigate(`/app/papers/${encodeURIComponent(documentIds[0])}/learn?selectedDocs=${encodeURIComponent(documentIds.join(','))}`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBatchAnalyzing(false)
    }
  }

  const isUploadingActive = uploadQueue.some((e) => e.status === 'uploading')

  return (
    <div
      className={`papers-page ${isDragging ? 'is-dragging-files' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer?.files?.length) {
          handleFilesSelected(e.dataTransfer.files)
        }
      }}
    >
      {/* Hidden Native File Input — triggered directly by the blue button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFilesSelected(e.target.files)
          }
          e.target.value = ''
        }}
      />

      {/* Page Header with Original Working Blue Button and Demo Loader */}
      <header className="papers-page-heading">
        <div>
          <span className="eyebrow">YOUR PRIVATE LIBRARY</span>
          <h2>My Papers</h2>
          <p>
            Keep your study PDFs together. Upload textbooks, research papers, and lecture notes.
            (10 sample PDFs ready in <code className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">Desktop/sample_pdfs</code>)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick Demo Paper Loader */}
          <button
            type="button"
            className="button button-secondary flex items-center gap-1.5 text-xs font-bold py-2.5 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs"
            onClick={handleSeedSamples}
            disabled={seeding || isUploadingActive}
            title="Instantly import 10 curated academic & research papers"
          >
            {seeding ? (
              <>
                <LoaderCircle className="spin text-indigo-600" size={15} /> Loading Demo Papers…
              </>
            ) : (
              <>
                <Sparkles size={15} className="text-amber-500" /> Load 10 Demo Papers
              </>
            )}
          </button>

          {/* Import URL / Video Link Button */}
          <button
            type="button"
            className="button button-secondary flex items-center gap-1.5 text-xs font-bold py-2.5 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs"
            onClick={() => setShowUrlModal(true)}
            disabled={isUploadingActive}
            title="Import a YouTube video lecture or web article URL"
          >
            <Video size={15} className="text-rose-500" /> Import Video / URL
          </button>

          {/* The Original Blue Button — directly opens the native file selector for multiple PDFs */}
          <button
            type="button"
            className="button button-primary papers-upload-button flex items-center gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingActive}
            title="Click to select multiple PDF files from your computer"
          >
            {isUploadingActive ? (
              <>
                <LoaderCircle className="spin" size={17} /> Uploading…
              </>
            ) : (
              <>
                <Plus size={17} /> Upload PDFs
              </>
            )}
          </button>
        </div>
      </header>

      {/* URL / Video Import Modal */}
      <AnimatePresence>
        {showUrlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                    <Video size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Import Video Lecture or Web Article</h3>
                    <p className="text-[11px] text-slate-500">Paste a YouTube link or website URL to generate study notes & maps.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUrlModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleImportUrl} className="p-5 space-y-4">
                {urlError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                    <AlertCircle size={15} /> {urlError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Video or Website URL <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://www.youtube.com/watch?v=... or https://wikipedia.org/..."
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Supports YouTube video lectures, Coursera, Vimeo, and educational articles.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Custom Topic / Subject Title <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Discrete Math: Module 3 Relations Lecture"
                    value={inputTitle}
                    onChange={(e) => setInputTitle(e.target.value)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowUrlModal(false)}
                    className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingUrl || !inputUrl.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {submittingUrl ? (
                      <>
                        <LoaderCircle size={14} className="spin" /> Ingesting & Generating…
                      </>
                    ) : (
                      <>
                        <Video size={14} /> Import & Generate Notes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Live Upload Progress Section (appears automatically when uploading) */}
      <AnimatePresence>
        {uploadQueue.length > 0 && (
          <motion.div
            className="mb-5 p-4 bg-white border border-indigo-100 rounded-2xl shadow-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <UploadCloud size={16} className="text-indigo-600" />
                Uploading Documents ({uploadQueue.filter((e) => e.status === 'uploading').length} in progress)
              </span>
              <button
                type="button"
                onClick={() => setUploadQueue((prev) => prev.filter((e) => e.status === 'uploading'))}
                className="text-[11px] font-semibold text-slate-400 hover:text-slate-600"
              >
                Clear finished
              </button>
            </div>

            <div className="space-y-2.5">
              {uploadQueue.map((item) => (
                <div key={item.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center gap-3">
                  <FileText size={18} className="text-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800 truncate" title={item.name}>
                        {item.name}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-2 shrink-0">
                        {formatSize(item.size)}
                      </span>
                    </div>

                    {item.status === 'uploading' && (
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-1.5 rounded-full transition-all duration-200"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}

                    {item.status === 'uploaded' && (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mt-1">
                        <Check size={12} /> Ready in library
                      </span>
                    )}

                    {item.status === 'duplicate' && (
                      <span className="text-[11px] font-medium text-amber-600 flex items-center gap-1 mt-1">
                        Already in your library
                      </span>
                    )}

                    {item.status === 'failed' && (
                      <span className="text-[11px] font-medium text-rose-600 flex items-center gap-1 mt-1">
                        <AlertCircle size={12} /> {item.error || 'Upload failed'}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => dismissQueueItem(item.id)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                    title="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Actions Toolbar */}
      {selectedIds.length > 0 && (
        <div className="papers-batch-toolbar">
          <span>{selectedIds.length} {selectedIds.length === 1 ? 'paper' : 'papers'} selected</span>
          <button className="button button-primary" onClick={startBatchAnalysis} disabled={batchAnalyzing}>
            {batchAnalyzing ? <><LoaderCircle className="spin" size={15} /> Starting…</> : <><Sparkles size={15} /> Learn selected</>}
          </button>
        </div>
      )}

      {/* Main Papers Library Content */}
      <section className="papers-library" aria-label="Your PDF library">
        <div className="papers-toolbar">
          <div className="papers-result-count">
            <strong>{totalCount}</strong> {totalCount === 1 ? 'paper' : 'papers'}
            {(search || status) && <span> matching your filters</span>}
          </div>
          <div className="papers-controls">
            <label className="papers-search">
              <Search size={16} />
              <input
                aria-label="Search papers"
                placeholder="Search papers…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <label className="papers-filter">
              <span className="sr-only">Filter by upload status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                <option value="UPLOADED">Uploaded</option>
                <option value="PROCESSING">Processing</option>
                <option value="ANALYSIS_COMPLETED">Analysis complete</option>
                <option value="FAILED">Failed</option>
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </div>

        {error && <div className="papers-alert" role="alert"><AlertCircle size={16} />{error}</div>}
        {batchMessage && <div className="papers-success" role="status">{batchMessage}</div>}

        {loading ? (
          <div className="papers-loading">
            <LoaderCircle className="spin" size={22} />
            <span>Loading your papers…</span>
          </div>
        ) : documents.length > 0 ? (
          <>
            <div className="papers-grid">
              <AnimatePresence mode="popLayout">
                {documents.map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    onDetails={showDetails}
                    onDelete={deleteDocument}
                    onRename={renameDocument}
                    deleting={deletingId === document.id}
                    selected={selectedIds.includes(document.id)}
                    onSelect={toggleSelected}
                  />
                ))}
              </AnimatePresence>
            </div>
            {nextCursor && (
              <button className="button button-outline papers-load-more" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <><LoaderCircle className="spin" size={15} /> Loading…</> : <>Load more papers <ChevronDown size={15} /></>}
              </button>
            )}
          </>
        ) : (
          <div className="papers-empty">
            {search || status ? (
              <>
                <span className="papers-empty-icon"><Search size={23} /></span>
                <h3>No papers match this search</h3>
                <p>Try a different title or clear the selected status.</p>
                <button className="text-button" onClick={() => { setSearch(''); setStatus('') }}>Clear filters</button>
              </>
            ) : (
              <>
                <span className="papers-empty-art"><FolderOpen size={34} /><FileText className="papers-empty-file" size={19} /></span>
                <span className="eyebrow">A PLACE FOR YOUR IDEAS</span>
                <h3>Your paper library is ready</h3>
                <p>Add one PDF or a whole batch. Your papers stay private, and you can keep adding more over time.</p>
                {/* Working Blue Button in Empty State */}
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingActive}
                >
                  <Plus size={16} /> Add your first papers
                </button>
                <small>No document-count limit · up to {MAX_PDF_SIZE_MB} MB per PDF</small>
              </>
            )}
          </div>
        )}
      </section>

      {detailsError && (
        <div className="papers-alert papers-detail-alert" role="alert">
          <AlertCircle size={16} />{detailsError}
          <button onClick={() => setDetailsError('')} aria-label="Dismiss error"><X size={14} /></button>
        </div>
      )}

      {/* Details Dialog */}
      <AnimatePresence>
        {details && <DocumentDetails document={details} onClose={() => setDetails(null)} />}
      </AnimatePresence>
    </div>
  )
}
