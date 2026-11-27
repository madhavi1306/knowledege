import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowDownToLine,
  ChevronDown,
  FileText,
  FolderOpen,
  Info,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadDialog from '../components/UploadDialog.jsx'
import { apiRequest } from '../services/api.js'
import { MAX_PDF_SIZE_MB } from '../services/documents.js'

const PAGE_SIZE = 24
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

function DocumentCard({ document, onDetails, onDelete, deleting, selected, onSelect, onAnalyze, analyzing }) {
  const status = statusLabels[document.uploadStatus] || 'Uploaded'
  const selectable = ['UPLOADED', 'FAILED'].includes(document.uploadStatus)
  const actionLabel = {
    UPLOADED: 'Analyze',
    FAILED: 'Retry analysis',
    PROCESSING: 'View progress',
    ANALYSIS_COMPLETED: 'View analysis',
  }[document.uploadStatus] || 'Analyze'

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
              aria-label={`Select ${document.fileName} for batch analysis`}
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
        <div className="paper-card-actions">
          <button type="button" className="paper-action-button paper-analyze-button" onClick={() => onAnalyze(document)} disabled={analyzing}>
            {analyzing ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}
            {analyzing ? 'Starting…' : actionLabel}
          </button>
          <button type="button" className="paper-action-button" onClick={() => onDetails(document.id)}><Info size={14} /> Details</button>
          <a className="paper-action-button" href={`/api/documents/${encodeURIComponent(document.id)}/file`} target="_blank" rel="noopener noreferrer"><ArrowDownToLine size={14} /> Open PDF</a>
          <button type="button" className="paper-action-button paper-delete-button" onClick={() => onDelete(document)} disabled={deleting}>
            {deleting ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />}
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
        <a className="button button-primary detail-open-button" href={`/api/documents/${encodeURIComponent(document.id)}/file`} target="_blank" rel="noopener noreferrer">
          <ArrowDownToLine size={15} /> Open PDF
        </a>
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
  const [uploadOpen, setUploadOpen] = useState(false)
  const [details, setDetails] = useState(null)
  const [detailsError, setDetailsError] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [analyzingId, setAnalyzingId] = useState('')
  const [batchAnalyzing, setBatchAnalyzing] = useState(false)
  const [batchMessage, setBatchMessage] = useState('')

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

  async function showDetails(id) {
    setDetailsError('')
    try {
      const result = await apiRequest(`/api/documents/${encodeURIComponent(id)}`)
      setDetails(result.document)
    } catch (requestError) {
      setDetailsError(requestError.message)
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

  async function startAnalysis(document) {
    setError('')
    setBatchMessage('')
    if (['PROCESSING', 'ANALYSIS_COMPLETED'].includes(document.uploadStatus)) {
      navigate(`/app/papers/${encodeURIComponent(document.id)}/analysis`)
      return
    }

    setAnalyzingId(document.id)
    try {
      await apiRequest(`/api/analysis/${encodeURIComponent(document.id)}`, { method: 'POST' })
      setRefreshKey((current) => current + 1)
      navigate(`/app/papers/${encodeURIComponent(document.id)}/analysis`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setAnalyzingId('')
    }
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
        body: JSON.stringify({ documentIds }),
      })
      setSelectedIds([])
      setBatchMessage(`Analysis started for ${documentIds.length} ${documentIds.length === 1 ? 'paper' : 'papers'}.`)
      setRefreshKey((current) => current + 1)
      navigate(`/app/papers/${encodeURIComponent(documentIds[0])}/analysis`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBatchAnalyzing(false)
    }
  }

  return (
    <div className="papers-page">
      <header className="papers-page-heading">
        <div>
          <span className="eyebrow">YOUR PRIVATE LIBRARY</span>
          <h2>My Papers</h2>
          <p>Keep your study PDFs together. They’re only visible to you.</p>
        </div>
        <button className="button button-primary papers-upload-button" onClick={() => setUploadOpen(true)}>
          <Plus size={17} /> Upload PDFs
        </button>
      </header>
      {selectedIds.length > 0 && (
        <div className="papers-batch-toolbar">
          <span>{selectedIds.length} {selectedIds.length === 1 ? 'paper' : 'papers'} selected</span>
          <button className="button button-primary" onClick={startBatchAnalysis} disabled={batchAnalyzing}>
            {batchAnalyzing ? <><LoaderCircle className="spin" size={15} /> Starting…</> : <><Sparkles size={15} /> Analyze selected</>}
          </button>
        </div>
      )}

      <section className="papers-library" aria-label="Your PDF library">
        <div className="papers-toolbar">
          <div className="papers-result-count">
            <strong>{totalCount}</strong> {totalCount === 1 ? 'paper' : 'papers'}
            {(search || status) && <span> matching your filters</span>}
          </div>
          <div className="papers-controls">
            <label className="papers-search">
              <Search size={16} />
              <input aria-label="Search papers" placeholder="Search papers…" value={search} onChange={(event) => setSearch(event.target.value)} />
              {search && <button className="icon-button" type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}
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
          <div className="papers-loading"><LoaderCircle className="spin" size={22} /><span>Loading your papers…</span></div>
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
                    deleting={deletingId === document.id}
                    selected={selectedIds.includes(document.id)}
                    onSelect={toggleSelected}
                    onAnalyze={startAnalysis}
                    analyzing={analyzingId === document.id}
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
                <button className="button button-primary" onClick={() => setUploadOpen(true)}><Plus size={16} /> Add your first papers</button>
                <small>No document-count limit · up to {MAX_PDF_SIZE_MB} MB per PDF</small>
              </>
            )}
          </div>
        )}
      </section>

      {detailsError && <div className="papers-alert papers-detail-alert" role="alert"><AlertCircle size={16} />{detailsError}<button onClick={() => setDetailsError('')} aria-label="Dismiss error"><X size={14} /></button></div>}

      <AnimatePresence>
        {uploadOpen && <UploadDialog key="upload-dialog" onClose={() => setUploadOpen(false)} onUploaded={refreshDocuments} />}
      </AnimatePresence>
      <AnimatePresence>
        {details && <DocumentDetails document={details} onClose={() => setDetails(null)} />}
      </AnimatePresence>
    </div>
  )
}
