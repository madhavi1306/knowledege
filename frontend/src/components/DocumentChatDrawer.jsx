import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  CornerDownLeft,
  FileText,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  ListOrdered,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Table as TableIcon,
  Trash2,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../services/api.js'
import { SUPPORTED_LANGUAGES, speakInLanguage } from '../services/i18n.js'

export default function DocumentChatDrawer({
  documentId,
  documentTitle,
  activeTopic = null,
  isOpen,
  onClose,
  embedded = false,
}) {
  const [messages, setMessages] = useState([])
  const [chatLanguage, setChatLanguage] = useState('en')
  const [speakingMsgId, setSpeakingMsgId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [inputQuestion, setInputQuestion] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)

  // 1. Load active chat session
  async function loadSession() {
    if (!documentId) return
    try {
      setLoading(true)
      const data = await apiRequest(`/api/chat/${encodeURIComponent(documentId)}/session`)
      setSessionId(data.session?.id || null)
      setMessages(data.session?.messages || [])
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to load conversation history.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Clear conversation
  async function handleClearSession() {
    if (!sessionId) return
    try {
      await apiRequest(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      })
      setMessages([])
    } catch (err) {
      setError(err.message || 'Failed to clear conversation.')
    }
  }

  // 3. Send question
  async function handleSendQuestion(overrideQuestion = null) {
    const q = (overrideQuestion || inputQuestion).trim()
    if (!q || sending) return

    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: q,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, tempUserMsg])
    if (!overrideQuestion) setInputQuestion('')
    setSending(true)
    setError('')

    try {
      const endpoint = sessionId
        ? `/api/chat/${encodeURIComponent(documentId)}/sessions/${encodeURIComponent(sessionId)}/messages`
        : `/api/chat/${encodeURIComponent(documentId)}/ask`

      const res = await apiRequest(endpoint, {
        method: 'POST',
        body: {
          question: q,
          topicId: activeTopic?.id || null,
          language: chatLanguage,
        },
      })

      if (res.session?.id && !sessionId) {
        setSessionId(res.session.id)
      }

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        res.userMessage,
        res.assistantMessage,
      ])
    } catch (err) {
      setError(err.message || 'Failed to get answer.')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (isOpen || embedded) {
      loadSession()
    }
  }, [documentId, isOpen, embedded])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const quickPromptsByLang = {
    en: [
      { label: 'Explain simpler', icon: Lightbulb, query: 'Can you explain this topic more simply in easy English?' },
      { label: 'Real-world example', icon: Sparkles, query: 'Give me a relatable real-world example of this concept.' },
      { label: 'Step-by-step', icon: ListOrdered, query: 'Break down how this works step by step.' },
      { label: 'Quick revision', icon: BookOpen, query: 'Give me a quick revision summary and key bullet points.' },
      { label: 'Unfamiliar words', icon: HelpCircle, query: 'What are the difficult words or technical terms here, and what do they mean in plain English?' },
    ],
    kn: [
      { label: 'ಸರಳವಾಗಿ ವಿವರಿಸಿ', icon: Lightbulb, query: 'ದಯವಿಟ್ಟು ಈ ವಿಷಯವನ್ನು ಸರಳ ಕನ್ನಡದಲ್ಲಿ ವಿವರಿಸಿ.' },
      { label: 'ನೈಜ ಉದಾಹರಣೆ', icon: Sparkles, query: 'ಈ ವಿಷಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದಂತೆ ಒಂದು ಉತ್ತಮ ನೈಜ ಉದಾಹರಣೆ ಕೊಡಿ.' },
      { label: 'ಹಂತ-ಹಂತವಾಗಿ', icon: ListOrdered, query: 'ಇದು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ ಎಂಬುದನ್ನು ಹಂತ-ಹಂತವಾಗಿ ತಿಳಿಸಿ.' },
      { label: 'ತ್ವರಿತ ಪುನರಾವರ್ತನೆ', icon: BookOpen, query: 'ಈ ವಿಷಯದ ಪ್ರಮುಖ ಮುಖ್ಯಾಂಶಗಳು ಮತ್ತು ಪುನರಾವರ್ತನಾ ಸಾರಾಂಶ ನೀಡಿ.' },
      { label: 'ಕಠಿಣ ಪದಗಳು', icon: HelpCircle, query: 'ಇಲ್ಲಿರುವ ಕಠಿಣ ತಾಂತ್ರಿಕ ಪದಗಳ ಅರ್ಥವನ್ನು ಸುಲಭವಾಗಿ ತಿಳಿಸಿ.' },
    ],
    hi: [
      { label: 'सरल व्याख्या', icon: Lightbulb, query: 'कृपया इस विषय को सरल हिंदी में समझाएं।' },
      { label: 'वास्तविक उदाहरण', icon: Sparkles, query: 'इस अवधारणा का एक वास्तविक दैनिक जीवन का उदाहरण दें।' },
      { label: 'चरण-दर-चरण', icon: ListOrdered, query: 'यह प्रक्रिया चरण-दर-चरण कैसे काम करती है, बताएं।' },
      { label: 'त्वरित पुनरावृत्ति', icon: BookOpen, query: 'इस विषय के मुख्य बिंदु और सारांश दें।' },
      { label: 'कठिन शब्द', icon: HelpCircle, query: 'इस विषय के कठिन तकनीकी शब्दों का सरल अर्थ बताएं।' },
    ],
    ta: [
      { label: 'எளிய விளக்கம்', icon: Lightbulb, query: 'தயவுசெய்து இந்த பாடத்தை எளிய தமிழில் விளக்குங்கள்.' },
      { label: 'உதாரணம்', icon: Sparkles, query: 'இந்த கருத்துக்கு ஒரு நிஜ வாழ்க்கை உதாரணம் தாருங்கள்.' },
    ],
    te: [
      { label: 'సులభమైన వివరణ', icon: Lightbulb, query: 'దయచేసి ఈ అంశాన్ని సులభమైన తెలుగులో వివరించండి.' },
      { label: 'నిజ జీవిత ఉదాహరణ', icon: Sparkles, query: 'ఈ కాన్సెప్ట్‌కు ఒక స్పష్టమైన ఉదాహరణ ఇవ్వండి.' },
    ],
  }

  const quickPrompts = quickPromptsByLang[chatLanguage] || quickPromptsByLang.en

  if (!isOpen && !embedded) return null

  const content = (
    <div className={`flex flex-col h-full bg-white ${embedded ? 'rounded-2xl border border-slate-200 shadow-sm' : 'border-l border-slate-200'}`}>
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Bot size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900">Document AI Tutor</h3>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                Grounded Q&A
              </span>
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-1">
              {activeTopic ? `Focusing on: ${activeTopic.name || activeTopic.topicTitle}` : documentTitle || 'Document Q&A'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Multilingual Selector */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs shadow-2xs">
            <Globe size={13} className="text-indigo-600" />
            <select
              value={chatLanguage}
              onChange={(e) => setChatLanguage(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              title="Change AI tutor response language"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.native}
                </option>
              ))}
            </select>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearSession}
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title="Clear conversation"
            >
              <Trash2 size={15} />
            </button>
          )}
          {!embedded && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title="Close Q&A Drawer"
            >
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-3 py-2 border-b border-slate-100 bg-white overflow-x-auto flex gap-1.5 no-scrollbar">
        {quickPrompts.map((p, idx) => {
          const Icon = p.icon
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendQuestion(p.query)}
              disabled={sending}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Icon size={12} /> {p.label}
            </button>
          )
        })}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <LoaderCircle className="animate-spin text-indigo-600" size={24} />
            <span className="text-xs">Loading grounded document memory…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="p-6 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
              <MessageSquare size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Ask Anything About This Document</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Ask about specific topics, chapters, diagrams, tables, or unfamiliar words. All answers are grounded in your uploaded PDF with page citations.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap justify-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleSendQuestion('What is the main topic of this paper?')}
                className="text-[11px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-100 transition-colors"
              >
                "What is the main topic of this paper?"
              </button>
              <button
                type="button"
                onClick={() => handleSendQuestion('Summarize the key findings in easy English')}
                className="text-[11px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-100 transition-colors"
              >
                "Summarize key findings in easy English"
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageItem
              key={msg.id || idx}
              message={msg}
              documentId={documentId}
              chatLanguage={chatLanguage}
              speakingMsgId={speakingMsgId}
              onToggleSpeak={(text, id) => {
                if (speakingMsgId === id) {
                  if (typeof window !== 'undefined' && window.speechSynthesis) {
                    window.speechSynthesis.cancel()
                  }
                  setSpeakingMsgId(null)
                } else {
                  setSpeakingMsgId(id)
                  speakInLanguage(
                    text,
                    chatLanguage,
                    () => setSpeakingMsgId(id),
                    () => setSpeakingMsgId(null)
                  )
                }
              }}
            />
          ))
        )}

        {sending && (
          <div className="flex items-start gap-2.5 text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <LoaderCircle className="animate-spin text-indigo-600 shrink-0 mt-0.5" size={16} />
            <div>
              <p className="font-semibold text-slate-700">Retrieving relevant document chunks & synthesizing answer…</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Verifying page citations and grounding</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSendQuestion()
        }}
        className="p-3 border-t border-slate-200 bg-slate-50/50 flex gap-2"
      >
        <input
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          placeholder={activeTopic ? `Ask about "${activeTopic.name || activeTopic.topicTitle}" or document…` : 'Ask a question about this document…'}
          className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white shadow-2xs"
        />
        <button
          type="submit"
          disabled={sending || !inputQuestion.trim()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
        >
          {sending ? <LoaderCircle className="animate-spin" size={14} /> : <Send size={14} />}
          <span className="sr-only sm:not-sr-only">Ask</span>
        </button>
      </form>
    </div>
  )

  if (embedded) {
    return content
  }

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] z-50 shadow-2xl"
      >
        {content}
      </motion.aside>
    </AnimatePresence>
  )
}

function MessageItem({ message, documentId, chatLanguage, speakingMsgId, onToggleSpeak }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-xs text-xs shadow-xs space-y-1">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      </div>
    )
  }

  const isNotCovered = message.notCovered
  const directAnswer = message.directAnswer
  const simpleExplanation = message.simpleExplanation
  const example = message.example
  const importantPoints = Array.isArray(message.importantPoints) ? message.importantPoints : []
  const pageReferences = Array.isArray(message.pageReferences) ? message.pageReferences : []
  const citations = Array.isArray(message.citations) ? message.citations : []

  return (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-1">
        <Bot size={14} />
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs text-xs space-y-3.5">
        {/* Header with Language badge & Audio Listen button */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {message.language ? `Document AI Tutor (${message.language.toUpperCase()})` : 'Document AI Tutor'}
          </span>
          {onToggleSpeak && (
            <button
              type="button"
              onClick={() => onToggleSpeak(message.content || directAnswer || '', message.id)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors"
              title="Listen to this explanation in selected language"
            >
              {speakingMsgId === message.id ? (
                <>
                  <VolumeX size={13} className="text-rose-500 animate-pulse" /> Stop
                </>
              ) : (
                <>
                  <Volume2 size={13} /> Listen
                </>
              )}
            </button>
          )}
        </div>

        {/* Out-of-scope alert if applicable */}
        {isNotCovered && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2">
            <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Not Covered in Document
              </strong>
              <p className="text-[11px] text-amber-700 mt-0.5">
                This question is not addressed in your uploaded PDF. To prevent hallucination, KNOWFLOW answers only what is verified in the document.
              </p>
            </div>
          </div>
        )}

        {/* 1. Direct Answer */}
        {directAnswer && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
              <CheckCircle2 size={12} /> Direct Answer
            </span>
            <p className="text-slate-900 font-semibold leading-relaxed">{directAnswer}</p>
          </div>
        )}

        {/* 2. Simple Explanation */}
        {simpleExplanation && (
          <div className="space-y-1 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Lightbulb size={12} className="text-amber-500" /> In Simple English
            </span>
            <p className="text-slate-700 leading-relaxed">{simpleExplanation}</p>
          </div>
        )}

        {/* 3. Example */}
        {example && (
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
              <Sparkles size={12} className="text-amber-600" /> Relatable Example
            </span>
            <p className="text-amber-900 leading-relaxed font-medium">{example}</p>
          </div>
        )}

        {/* 4. Important Points */}
        {importantPoints.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Key Points to Remember
            </span>
            <ul className="space-y-1">
              {importantPoints.map((pt, pIdx) => (
                <li key={pIdx} className="flex items-start gap-1.5 text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 5. Document Page References */}
        {pageReferences.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Citations:</span>
            {pageReferences.map((p) => (
              <a
                key={p}
                href={`/api/documents/${encodeURIComponent(documentId)}/file#page=${p}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md transition-colors"
                title={`Open PDF at Page ${p}`}
              >
                <FileText size={11} /> Page {p}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
