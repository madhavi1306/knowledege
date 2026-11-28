import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  LoaderCircle,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { apiRequest } from '../services/api.js'

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
  },
})

export default function MermaidDiagram({
  chart,
  id = 'mermaid-chart',
  documentId = null,
  visualId = null,
  glossary = null, // { difficultWords, labelsExplanation, partsExplanation, connections }
  onWordClick = null,
}) {
  const containerRef = useRef(null)
  const [svgContent, setSvgContent] = useState('')
  const [renderError, setRenderError] = useState(null)
  const [selectedWordData, setSelectedWordData] = useState(null)
  const [wordLoading, setWordLoading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const activeUtteranceRef = useRef(null)

  // 1. Render Mermaid diagram to SVG
  useEffect(() => {
    let isMounted = true
    if (!chart || !chart.trim()) {
      setSvgContent('')
      return
    }

    const uniqueId = `mermaid-${id}-${Math.random().toString(36).substring(2, 9)}`
    try {
      mermaid
        .render(uniqueId, chart.trim())
        .then(({ svg }) => {
          if (isMounted) {
            setSvgContent(svg)
            setRenderError(null)
          }
        })
        .catch((err) => {
          console.warn('Mermaid render error:', err)
          if (isMounted) {
            setRenderError(err.message || 'Diagram syntax error')
          }
        })
    } catch (err) {
      if (isMounted) {
        setRenderError(err.message || 'Diagram syntax error')
      }
    }

    return () => {
      isMounted = false
    }
  }, [chart, id])

  // 2. Attach click handlers to every node, text, and label in the SVG
  useEffect(() => {
    if (!containerRef.current || !svgContent) return

    const container = containerRef.current
    const svgEl = container.querySelector('svg')
    if (!svgEl) return

    // Find all interactive nodes, texts, and shapes
    const interactiveElements = svgEl.querySelectorAll(
      '.node, .nodeLabel, text, g.cluster, .edgeLabel, polygon, rect'
    )

    interactiveElements.forEach((el) => {
      const text = el.textContent?.trim()
      if (text && text.length > 1) {
        el.style.cursor = 'pointer'
        el.setAttribute('title', `Click "${text}" to see simple meaning`)

        // Add subtle hover class or style
        el.classList.add('mermaid-interactive-node')
      }
    })

    function handleSvgClick(event) {
      // Find closest node or text element
      const target = event.target.closest('.node, .nodeLabel, text, .edgeLabel')
      if (!target) return

      const text = target.textContent?.trim()
      if (!text || text.length <= 1) return

      event.stopPropagation()
      handleWordInspect(text)
    }

    svgEl.addEventListener('click', handleSvgClick)

    return () => {
      svgEl.removeEventListener('click', handleSvgClick)
    }
  }, [svgContent, glossary, documentId, visualId])

  // 3. Lookup or fetch simple meaning of the clicked word/label
  async function handleWordInspect(rawText) {
    // Clean up label text (strip punctuation, extra numbers)
    const cleanWord = rawText.replace(/[\[\]\(\)\{\}\"\'\<\>]/g, '').trim()
    if (!cleanWord) return

    // Call optional parent handler
    onWordClick?.(cleanWord)

    // Check local visual glossary first for immediate response
    if (glossary) {
      const lower = cleanWord.toLowerCase()

      // A. Check difficultWords
      const diffMatch = glossary.difficultWords?.find(
        (w) => (w.word || '').toLowerCase() === lower || lower.includes((w.word || '').toLowerCase())
      )
      if (diffMatch) {
        setSelectedWordData({
          word: diffMatch.word || cleanWord,
          simpleMeaning: diffMatch.simpleMeaning,
          explanation: diffMatch.explanation || `Key technical concept shown in this diagram.`,
          example: diffMatch.example || `Observe how it connects with adjacent boxes.`,
          roleInDiagram: `Identified as a critical component in this visual.`,
        })
        return
      }

      // B. Check labelsExplanation
      const labelMatch = glossary.labelsExplanation?.find(
        (l) => (l.label || '').toLowerCase() === lower || lower.includes((l.label || '').toLowerCase())
      )
      if (labelMatch) {
        setSelectedWordData({
          word: labelMatch.label || cleanWord,
          simpleMeaning: labelMatch.meaning,
          explanation: `A label identifying this specific element or stage in the process.`,
          example: `Connects parts together in the visual flow.`,
          roleInDiagram: `Visual label identifying this part of the diagram.`,
        })
        return
      }

      // C. Check partsExplanation
      const partMatch = glossary.partsExplanation?.find(
        (p) => (p.part || '').toLowerCase() === lower || lower.includes((p.part || '').toLowerCase())
      )
      if (partMatch) {
        setSelectedWordData({
          word: partMatch.part || cleanWord,
          simpleMeaning: partMatch.explanation,
          explanation: `Plays a functional role in this visual system.`,
          example: `Interacts with connected arrows and inputs/outputs.`,
          roleInDiagram: `Core component in the visual model.`,
        })
        return
      }
    }

    // If documentId is present, query backend for contextual meaning
    if (documentId) {
      setWordLoading(true)
      setSelectedWordData({ word: cleanWord, loading: true })
      try {
        const queryParams = new URLSearchParams({ word: cleanWord })
        if (visualId) queryParams.set('visualId', visualId)
        const res = await apiRequest(`/api/visuals/${encodeURIComponent(documentId)}/word-meaning?${queryParams}`)
        setSelectedWordData(res)
      } catch {
        setSelectedWordData({
          word: cleanWord,
          simpleMeaning: `A specific technical element or process stage in this diagram representing "${cleanWord}".`,
          explanation: `In this visual diagram, "${cleanWord}" indicates an active component or state transition.`,
          example: `Observe the direction of the connecting arrows into and out of "${cleanWord}".`,
          roleInDiagram: `Component node in the visual model.`,
        })
      } finally {
        setWordLoading(false)
      }
      return
    }

    // Default fast plain-language breakdown
    setSelectedWordData({
      word: cleanWord,
      simpleMeaning: `A core component or step in this diagram representing "${cleanWord}".`,
      explanation: `In this visual map, "${cleanWord}" acts as a connected node that guides the flow of information or process.`,
      example: `Follow the arrows leading into and out of "${cleanWord}" to trace its connection.`,
      roleInDiagram: `Active node in this diagram.`,
    })
  }

  // 4. Speech Synthesis to read definition aloud
  function speakWordMeaning(word, meaning) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    window.speechSynthesis.cancel()
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
    }

    const textToSpeak = `${word}. Simple meaning: ${meaning}`
    const utterance = new SpeechSynthesisUtterance(textToSpeak)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.lang = 'en-US'

    const voices = window.speechSynthesis.getVoices()
    const voice = voices.find((v) => v.lang.startsWith('en'))
    if (voice) utterance.voice = voice

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    activeUtteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  if (renderError) {
    return (
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
        <p className="font-semibold mb-1">Diagram Structure:</p>
        <pre className="text-xs font-mono whitespace-pre-wrap">{chart}</pre>
      </div>
    )
  }

  return (
    <div className="relative w-full flex flex-col items-center">
      {/* Interactive Helper Hint */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 mb-2 bg-indigo-50/80 border border-indigo-100 rounded-lg text-[11px] text-indigo-700 font-medium">
        <span className="flex items-center gap-1.5">
          <Lightbulb size={13} className="text-amber-500 shrink-0" />
          <strong>Interactive Diagram:</strong> Click any word, box, or label to see its simple meaning!
        </span>
        <span className="text-[10px] text-indigo-500 uppercase tracking-wider font-bold">CLICK WORDS</span>
      </div>

      {/* SVG Diagram Canvas */}
      <div
        ref={containerRef}
        className="mermaid-wrapper w-full overflow-x-auto flex justify-center py-4 px-2 bg-white rounded-xl shadow-xs border border-slate-200 min-h-[220px]"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />

      {/* Floating Simple Meaning Popover Card */}
      <AnimatePresence>
        {selectedWordData && (
          <motion.div
            className="absolute z-50 bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border border-indigo-200 rounded-2xl shadow-xl p-4 overflow-hidden"
            initial={{ opacity: 0, y: 15, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.96 }}
            transition={{ duration: 0.18 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Sparkles size={16} />
                </span>
                <div>
                  <h4 className="text-sm font-black text-slate-900 leading-tight">
                    {selectedWordData.word}
                  </h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    Simple Meaning
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Voice Pronounce / Read Aloud */}
                {selectedWordData.simpleMeaning && (
                  <button
                    type="button"
                    onClick={() =>
                      speakWordMeaning(
                        selectedWordData.word,
                        selectedWordData.simpleMeaning
                      )
                    }
                    className={`p-1.5 rounded-lg transition-colors ${
                      isSpeaking
                        ? 'text-rose-600 bg-rose-50'
                        : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                    }`}
                    title={isSpeaking ? 'Stop speaking' : 'Read simple meaning aloud'}
                  >
                    {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  </button>
                )}

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isSpeaking) window.speechSynthesis?.cancel()
                    setSelectedWordData(null)
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                  aria-label="Close word meaning"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            {selectedWordData.loading || wordLoading ? (
              <div className="py-4 flex items-center justify-center gap-2 text-xs text-indigo-600 font-semibold">
                <LoaderCircle className="animate-spin" size={16} />
                <span>Finding simple meaning…</span>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs">
                {/* 1. Simple Meaning */}
                <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100/80">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide block mb-0.5">
                    What this means:
                  </span>
                  <p className="font-semibold text-slate-800 text-xs leading-relaxed">
                    {selectedWordData.simpleMeaning || 'A core element of this diagram.'}
                  </p>
                </div>

                {/* 2. Role in Diagram */}
                {selectedWordData.roleInDiagram && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">
                      Role in this diagram:
                    </span>
                    <p className="text-slate-600 leading-normal text-[11px]">
                      {selectedWordData.roleInDiagram}
                    </p>
                  </div>
                )}

                {/* 3. Easy Example / Analogy */}
                {selectedWordData.example && (
                  <div className="p-2 bg-amber-50/70 rounded-xl border border-amber-100 text-[11px] text-amber-900 flex items-start gap-1.5">
                    <Lightbulb size={13} className="text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <strong className="font-bold text-amber-800">Example: </strong>
                      <span>{selectedWordData.example}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
