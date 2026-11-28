import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Globe,
  HelpCircle,
  Mic,
  MicOff,
  Navigation,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import { SUPPORTED_LANGUAGES, speakInLanguage } from '../services/i18n.js'

const MULTILINGUAL_COMMANDS = {
  en: ['📊 Analyse Graph', 'Hi', 'Open my documents', 'Give me a test', 'Open weak topics', 'Explain the first topic'],
  kn: ['📊 ಜ್ಞಾನ ನಕ್ಷೆ ವಿಶ್ಲೇಷಿಸಿ', 'ನಮಸ್ಕಾರ', 'ದಾಖಲೆಗಳನ್ನು ತೆರೆ', 'ಪರೀಕ್ಷೆ ಕೊಡು', 'ಕಷ್ಟವಾದ ವಿಷಯಗಳು', 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ತೆರೆ'],
  hi: ['📊 ग्राफ का विश्लेषण करें', 'नमस्ते', 'दस्तावेज़ खोलो', 'टेस्ट दो', 'कमजोर टॉपिक', 'डैशबोर्ड खोलो'],
  ta: ['📊 வரைபட பகுப்பாய்வு', 'வணக்கம்', 'ஆவணங்களைத் திற', 'தேர்வு தொடங்கு', 'கடினமான பாடங்கள்'],
  te: ['📊 గ్రాఫ్ విశ్లేషణ', 'నమస్కారం', 'డాక్యుమెంట్లు తెరువు', 'పరీక్ష ప్రారంభించు', 'బలహీన అంశాలు'],
}

export default function VoiceAgentOverlay({ currentContext = {} }) {
  const [isOpen, setIsOpen] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState('en')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true) // Voice output toggle
  const [transcript, setTranscript] = useState('')
  const [textInput, setTextInput] = useState('')
  const [conversation, setConversation] = useState([
    {
      role: 'assistant',
      text: "Hello! I'm your KNOWFLOW AI Voice Assistant. Speak into your microphone, click a command chip, or type to navigate and study.",
    },
  ])
  const [processing, setProcessing] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [micPermissionState, setMicPermissionState] = useState('prompt') // 'granted', 'denied', 'prompt'
  const [hasSpeechRecognition, setHasSpeechRecognition] = useState(true)
  const [audioLevel, setAudioLevel] = useState(0)

  const activeRecognitionRef = useRef(null)
  const transcriptRef = useRef('')
  const sendMessageRef = useRef(null)
  const audioContextRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const animationFrameRef = useRef(null)
  const navigate = useNavigate()

  // 1. Check Speech Recognition support & warm up voices on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setHasSpeechRecognition(false)
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' })
        .then((permissionStatus) => {
          setMicPermissionState(permissionStatus.state)
          permissionStatus.onchange = () => {
            setMicPermissionState(permissionStatus.state)
          }
        })
        .catch(() => {})
    }

    // Warm up voices
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices()
      }
    }

    // Listen to global open voice event from topbar / sidebar
    function handleGlobalOpen(e) {
      setIsOpen(true)
      if (e.detail?.query) {
        sendMessageRef.current?.(e.detail.query)
      } else if (e.detail?.startListening) {
        startListening()
      }
    }

    window.addEventListener('knowflow:open-voice', handleGlobalOpen)
    return () => {
      window.removeEventListener('knowflow:open-voice', handleGlobalOpen)
      stopListening()
      interruptSpeech()
    }
  }, [])

  // 2. Real Speech Synthesis (Text-to-Speech) supporting all languages
  function speakText(text) {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return
    speakInLanguage(
      text,
      voiceLanguage,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    )
  }

  function interruptSpeech() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel()
      } catch {}
      setIsSpeaking(false)
    }
  }

  function testVoiceOutput() {
    interruptSpeech()
    const testMsg = "Hello! AI voice output is active and working. What would you like to learn today?"
    setConversation((prev) => [...prev, { role: 'assistant', text: testMsg }])
    speakText(testMsg)
  }

  // 3. Audio Level Visualizer using Web Audio API
  async function startAudioLevelVisualizer() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return null
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return stream

      const ctx = new AudioContext()
      audioContextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      function checkAudio() {
        if (!isListening) return
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const avg = sum / dataArray.length
        setAudioLevel(Math.min(100, Math.round(avg * 1.5)))
        animationFrameRef.current = requestAnimationFrame(checkAudio)
      }
      checkAudio()
      return stream
    } catch {
      return null
    }
  }

  function stopAudioVisualizer() {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close() } catch {}
      audioContextRef.current = null
    }
    setAudioLevel(0)
  }

  // 4. Start Listening with Fresh SpeechRecognition instance
  async function startListening() {
    interruptSpeech()
    setVoiceError('')
    setTranscript('')
    transcriptRef.current = ''

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    // Check microphone permission explicitly
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setMicPermissionState('granted')
        // Stop initial test tracks so device is immediately free for SpeechRecognition
        stream.getTracks().forEach((track) => track.stop())
      }
    } catch (err) {
      setMicPermissionState('denied')
      setVoiceError(
        'Microphone access is blocked. Please click the lock or settings icon in your browser URL bar to allow microphone access, or use the command chips below.'
      )
      return
    }

    if (!SpeechRecognition) {
      // Fallback: If browser does not have Web Speech API (e.g. Firefox or locked webview)
      setVoiceError(
        'Web Speech Recognition is not natively supported in this browser. You can click any command chip or type your message below.'
      )
      return
    }

    try {
      // Always create a FRESH instance to avoid InvalidStateError on repeated clicks
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === voiceLanguage) || SUPPORTED_LANGUAGES[0]
      recognition.lang = langConfig.voiceLang

      recognition.onstart = () => {
        setIsListening(true)
        setVoiceError('')
        startAudioLevelVisualizer()
      }

      recognition.onresult = (event) => {
        let interim = ''
        for (let i = 0; i < event.results.length; i++) {
          interim += event.results[i][0].transcript
        }
        transcriptRef.current = interim
        setTranscript(interim)
      }

      recognition.onend = () => {
        setIsListening(false)
        stopAudioVisualizer()
        const query = transcriptRef.current.trim()
        if (query) {
          sendMessageRef.current?.(query)
        }
      }

      recognition.onerror = (event) => {
        setIsListening(false)
        stopAudioVisualizer()
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setMicPermissionState('denied')
          setVoiceError('Microphone permission was denied. Please allow microphone in your browser address bar.')
        } else if (event.error === 'no-speech') {
          setVoiceError('No speech was detected. Please try speaking closer to the microphone.')
        } else if (event.error === 'network') {
          if (recognition.lang !== 'en-US' && !recognition._retried) {
            try {
              recognition._retried = true
              recognition.lang = 'en-US'
              recognition.start()
              setIsListening(true)
              startAudioLevelVisualizer()
              return
            } catch {}
          }
          setVoiceError('Browser cloud speech service is offline or unreachable. Click any action below or type to analyse instantly:')
        } else {
          setVoiceError(`Speech error: ${event.error}. You can also type or use command chips.`)
        }
      }

      activeRecognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      setIsListening(false)
      stopAudioVisualizer()
      setVoiceError(`Could not initialize microphone: ${err.message}`)
    }
  }

  function stopListening() {
    if (activeRecognitionRef.current) {
      try {
        activeRecognitionRef.current.stop()
      } catch {}
      activeRecognitionRef.current = null
    }
    setIsListening(false)
    stopAudioVisualizer()
  }

  function toggleListening() {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  // 5. Send Message to Backend Voice Agent Service
  async function handleSendMessage(msgText) {
    if (processing) return
    const query = (msgText || textInput).trim()
    if (!query) return

    setVoiceError('')
    setConversation((prev) => [...prev, { role: 'user', text: query }])
    setTextInput('')
    setTranscript('')
    transcriptRef.current = ''
    setProcessing(true)

    try {
      const documentMatch = currentContext.pathname?.match(/^\/app\/papers\/([^/]+)/)
      const conceptMatch = currentContext.pathname?.match(/^\/app\/concepts\/([^/]+)/)

      const res = await apiRequest('/api/voice-agent/chat', {
        method: 'POST',
        body: {
          message: query,
          context: {
            pathname: currentContext.pathname,
            language: voiceLanguage,
            ...(documentMatch ? { documentId: decodeURIComponent(documentMatch[1]) } : {}),
            ...(conceptMatch ? { conceptId: decodeURIComponent(conceptMatch[1]) } : {}),
          },
          history: conversation.slice(-8).map(({ role, text }) => ({ role, text })),
        },
      })

      const assistantMessage = {
        role: 'assistant',
        text: res.reply,
        action: res.action || null,
      }

      setConversation((prev) => [...prev, assistantMessage])
      speakText(res.reply)

      // Execute real application navigation
      if (res.action?.type === 'NAVIGATE' && res.action?.path) {
        setTimeout(() => {
          navigate(res.action.path)
        }, 500)
      }
    } catch (err) {
      const errorMessage = err.message || 'Error communicating with Voice Assistant.'
      setConversation((prev) => [
        ...prev,
        { role: 'assistant', text: `Voice Assistant notice: ${errorMessage}` },
      ])
    } finally {
      setProcessing(false)
    }
  }
  sendMessageRef.current = handleSendMessage

  return (
    <>
      {/* Floating Action Button with clear icon and tooltip */}
      <button
        type="button"
        className={`voice-agent-fab ${isSpeaking ? 'is-speaking' : ''} ${isListening ? 'is-listening' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open AI Voice Assistant"
        title="AI Voice Assistant — Speak or Type (Phase 10)"
      >
        {isListening ? (
          <Mic size={24} className="text-rose-300 animate-pulse" />
        ) : isSpeaking ? (
          <Volume2 size={24} className="text-emerald-300" />
        ) : (
          <Mic size={24} />
        )}
        <span className="fab-voice-badge">Voice</span>
      </button>

      {/* Conversational Voice Assistant Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="voice-agent-pane"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="voice-pane-header">
              <div className="voice-title flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Mic size={18} />
                </span>
                <div className="flex flex-col">
                  <strong className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    KNOWFLOW AI Voice
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-700">ONLINE</span>
                  </strong>
                  <span className="text-[10px] text-slate-400 font-medium">Conversational Assistant & Navigation</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Language Selector */}
                <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-2xs">
                  <Globe size={13} className="text-indigo-600" />
                  <select
                    value={voiceLanguage}
                    onChange={(e) => {
                      const newLang = e.target.value
                      setVoiceLanguage(newLang)
                      interruptSpeech()
                      stopListening()
                      const welcome = {
                        en: "Language set to English. Speak or type to navigate and study.",
                        kn: "ಭಾಷೆಯನ್ನು ಕನ್ನಡಕ್ಕೆ ಹೊಂದಿಸಲಾಗಿದೆ. ಅಧ್ಯಯನ ಮಾಡಲು ಮಾತನಾಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.",
                        hi: "भाषा हिंदी चुनी गई है। अध्ययन या नेविगेट करने के लिए बोलें या लिखें।",
                        ta: "மொழி தமிழாக மாற்றப்பட்டது. பேசவும் அல்லது தட்டச்சு செய்யவும்.",
                        te: "భాష తెలుగుగా మార్చబడింది. మాట్లాడండి లేదా టైప్ చేయండి.",
                      }[newLang] || "Language updated."
                      setConversation((prev) => [...prev, { role: 'assistant', text: welcome }])
                      speakInLanguage(welcome, newLang, () => setIsSpeaking(true), () => setIsSpeaking(false))
                    }}
                    className="text-[11px] font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                    title="Change AI voice language"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.native}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Voice Output Toggle */}
                <button
                  type="button"
                  className={`icon-btn p-1.5 rounded-lg transition-colors ${
                    voiceEnabled ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'
                  }`}
                  onClick={() => {
                    if (voiceEnabled) interruptSpeech()
                    setVoiceEnabled((prev) => !prev)
                  }}
                  title={voiceEnabled ? 'Mute AI voice responses' : 'Enable AI voice responses'}
                >
                  {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  className="icon-btn p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => {
                    interruptSpeech()
                    stopListening()
                    setIsOpen(false)
                  }}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Visualizer & Microphone Orb */}
            <div className="voice-visualizer">
              <div
                className={`voice-orb ${
                  isListening ? 'listening-orb' : isSpeaking ? 'speaking-orb' : ''
                }`}
                onClick={toggleListening}
                role="button"
                tabIndex={0}
                title={isListening ? 'Click to stop listening' : 'Click to start speaking'}
              >
                {isListening ? (
                  <Mic size={32} className="text-rose-500 animate-pulse" />
                ) : isSpeaking ? (
                  <Volume2 size={32} className="text-emerald-500 animate-bounce" />
                ) : (
                  <Mic size={32} className="text-indigo-600" />
                )}
                {isListening && (
                  <div
                    className="orb-soundwave-ring"
                    style={{ transform: `scale(${1 + audioLevel / 60})` }}
                  />
                )}
              </div>

              <span className="voice-status-text">
                {isListening
                  ? 'Listening to your voice… Click again when finished'
                  : isSpeaking
                  ? 'Speaking aloud… (Click orb to interrupt)'
                  : processing
                  ? 'Thinking and preparing response…'
                  : 'Ready. Click microphone to speak, or select below.'}
              </span>

              {/* Speaker Test Button */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={testVoiceOutput}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors"
                  title="Test if your speakers/headphones produce voice"
                >
                  <Volume2 size={12} /> Test Audio (TTS)
                </button>
                {micPermissionState === 'denied' && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                    Mic blocked in browser
                  </span>
                )}
              </div>
            </div>

            {/* Quick Command Navigation Chips */}
            <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/50 flex gap-1.5 overflow-x-auto no-scrollbar">
              {(MULTILINGUAL_COMMANDS[voiceLanguage] || MULTILINGUAL_COMMANDS.en).map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => handleSendMessage(cmd)}
                  disabled={processing}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 text-slate-700 whitespace-nowrap transition-colors flex items-center gap-1 border border-slate-200/80 shadow-xs"
                >
                  <Sparkles size={10} className="text-amber-500" /> {cmd}
                </button>
              ))}
            </div>

            {/* Conversation Transcript Log */}
            <div className="voice-conversation-log">
              {conversation.map((c, i) => (
                <div key={i} className={`voice-bubble bubble-${c.role}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span>{c.text}</span>
                    {c.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => speakText(c.text)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 shrink-0"
                        title="Read this response aloud"
                      >
                        <Volume2 size={13} />
                      </button>
                    )}
                  </div>
                  {c.action?.type === 'NAVIGATE' && (
                    <button
                      type="button"
                      onClick={() => navigate(c.action.path)}
                      className="mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 underline"
                    >
                      <Navigation size={10} /> Open {c.action.label}
                    </button>
                  )}
                </div>
              ))}
              {transcript && (
                <div className="voice-bubble bubble-user bubble-interim">
                  <span>{transcript}…</span>
                </div>
              )}
            </div>

            {/* Error & Permission Notification */}
            {voiceError && (
              <div className="mx-3.5 mb-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-[11px] font-medium text-amber-900">
                <div className="flex items-start gap-1.5">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-700" />
                  <span>{voiceError}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-amber-200/60">
                  <button
                    type="button"
                    onClick={() => handleSendMessage('Analyse the knowledge graph')}
                    className="px-2 py-0.5 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold transition-colors text-[10px]"
                  >
                    📊 Analyse Graph
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage('Open my documents')}
                    className="px-2 py-0.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-bold transition-colors text-[10px]"
                  >
                    📄 Open Papers
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage('Give me a test')}
                    className="px-2 py-0.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-bold transition-colors text-[10px]"
                  >
                    📝 Start Test
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Controls Bar */}
            <div className="voice-controls">
              <button
                type="button"
                className={`btn-voice-mic ${isListening ? 'is-active' : ''}`}
                onClick={toggleListening}
                title={isListening ? 'Click to stop listening' : 'Click to speak into microphone'}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {isSpeaking && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary interrupt-btn"
                  onClick={interruptSpeech}
                >
                  <VolumeX size={14} /> Stop
                </button>
              )}

              {/* Text Fallback Form */}
              <form
                className="voice-input-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendMessage()
                }}
              >
                <input
                  type="text"
                  placeholder="Speak or type a question…"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="voice-text-input"
                />
                <button
                  type="submit"
                  className="btn-voice-send"
                  disabled={processing || !textInput.trim()}
                  title="Send message"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
