import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Bot,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DocumentChatDrawer from '../components/DocumentChatDrawer.jsx'
import { apiRequest } from '../services/api.js'

export default function DocumentChatPage() {
  const { documentId } = useParams()
  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDoc() {
      try {
        setLoading(true)
        const data = await apiRequest(`/api/documents/${encodeURIComponent(documentId)}`)
        setDocument(data.document)
      } catch (err) {
        setError(err.message || 'Failed to load document info.')
      } finally {
        setLoading(false)
      }
    }
    loadDoc()
  }, [documentId])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to={`/app/papers/${encodeURIComponent(documentId)}/learn`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft size={14} /> Back to Learning Workspace
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                <Sparkles size={12} /> Phase 6 Document-Based AI Q&A
              </span>
              <h1 className="text-base font-bold text-slate-900 line-clamp-1">
                {document?.fileName || 'Document AI Tutor'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/app/papers/${encodeURIComponent(documentId)}/learn`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors"
            >
              <BookOpen size={14} /> Structured Notes
            </Link>
            <Link
              to={`/app/papers/${encodeURIComponent(documentId)}/visuals`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition-colors"
            >
              <ImageIcon size={14} /> Visuals
            </Link>
            <a
              href={`/api/documents/${encodeURIComponent(documentId)}/file`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <ExternalLink size={14} /> View PDF
            </a>
          </div>
        </div>
      </header>

      {/* Main Full-Page Chat Container */}
      <div className="max-w-4xl mx-auto w-full flex-1 p-6 flex flex-col">
        <div className="flex-1 min-h-[600px] flex flex-col">
          <DocumentChatDrawer
            documentId={documentId}
            documentTitle={document?.fileName}
            embedded={true}
          />
        </div>
      </div>
    </div>
  )
}
