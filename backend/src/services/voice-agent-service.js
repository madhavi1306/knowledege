import { HttpError } from '../utils/http-error.js'
import {
  detectLanguage,
  GREETINGS,
  NAVIGATION_REPLIES,
  CONCEPT_EXPLANATIONS,
} from './multilingual-ai.js'

const navigationTargets = [
  { pattern: /\b(upload|documents?|papers?|library)\b/i, path: '/app/papers', key: 'library', label: 'your documents' },
  { pattern: /\b(dashboard|home)\b/i, path: '/app', key: 'dashboard', label: 'your dashboard' },
  { pattern: /\b(progress|analytics|scores?)\b/i, path: '/app/analytics', key: 'progress', label: 'your progress' },
  { pattern: /\b(quiz|quizzes|test|tests|assessment)\b/i, path: '/app/quizzes', key: 'test', label: 'tests and quizzes' },
  { pattern: /\b(weak topics?|weak concepts?|recovery)\b/i, path: '/app/recovery', key: 'weakTopics', label: 'weak-topic recovery' },
  { pattern: /\b(revision|review|spaced repetition)\b/i, path: '/app/revision', key: 'weakTopics', label: 'revision' },
  { pattern: /\b(knowledge graph|concept map|graph)\b/i, path: '/app/graph', key: 'graph', label: 'the knowledge graph' },
  { pattern: /\b(learning path|study path)\b/i, path: '/app/learning-path', key: 'path', label: 'your learning path' },
]

function getNavigationAction(message, lang = 'en') {
  const lower = message.toLocaleLowerCase()

  // Multilingual Navigation Patterns
  // 1. Documents / Library
  if (
    /\b(open|show|view|navigate to)\s+(my\s+)?(documents?|library|papers?)\b/i.test(lower) ||
    /(ದಾಖಲೆಗಳು|ಪುಸ್ತಕಗಳು|ಲೈಬ್ರರಿ|ದಸ್ತಾವೇಜು|ದಾಖಲೆಗಳನ್ನು ತೆರೆ)/.test(message) ||
    /(दस्तावेज़|किताबें|लाइब्रेरी|दस्तावेज़ खोलो)/.test(message) ||
    /(ஆவணங்கள்|புத்தகங்கள்|திறக்க)/.test(message) ||
    /(డాక్యుమెంట్లు|లైబ్రరీ|తెరవండి)/.test(message)
  ) {
    return {
      reply: NAVIGATION_REPLIES[lang]?.library || NAVIGATION_REPLIES.en.library,
      action: { type: 'NAVIGATE', path: '/app/papers', label: 'documents' },
    }
  }

  // 2. Dashboard
  if (
    /\b(dashboard|home)\b/i.test(lower) ||
    /(ಡ್ಯಾಶ್‌ಬೋರ್ಡ್|ಮುಖ್ಯ ಪುಟ)/.test(message) ||
    /(डैशबोर्ड|होम)/.test(message) ||
    /(டாஷ்போர்ட்)/.test(message) ||
    /(డాష్‌బోర్డ్)/.test(message)
  ) {
    return {
      reply: NAVIGATION_REPLIES[lang]?.dashboard || NAVIGATION_REPLIES.en.dashboard,
      action: { type: 'NAVIGATE', path: '/app', label: 'dashboard' },
    }
  }

  // 3. Progress / Analytics
  if (
    /\b(progress|analytics|scores?)\b/i.test(lower) ||
    /(ಪ್ರಗತಿ|ಅಂಕಗಳು)/.test(message) ||
    /(प्रगति|विश्लेषण)/.test(message) ||
    /(முன்னேற்றம்)/.test(message) ||
    /(పురోగతి)/.test(message)
  ) {
    return {
      reply: NAVIGATION_REPLIES[lang]?.progress || NAVIGATION_REPLIES.en.progress,
      action: { type: 'NAVIGATE', path: '/app/analytics', label: 'progress' },
    }
  }

  // 4. Weak Topics & Revision
  if (
    /\b(weak topics?|weak concepts?|recovery|revision|review)\b/i.test(lower) ||
    /(ಕಷ್ಟವಾದ ವಿಷಯಗಳು|ಪುನರಾವರ್ತನೆ|ಪರಿಷ್ಕರಣೆ)/.test(message) ||
    /(कमजोर विषय|पुनरावृत्ति)/.test(message) ||
    /(கடினமான பாடங்கள்|திருப்புதல்)/.test(message) ||
    /(బలహీన అంశాలు|రివిజన్)/.test(message)
  ) {
    return {
      reply: NAVIGATION_REPLIES[lang]?.weakTopics || NAVIGATION_REPLIES.en.weakTopics,
      action: { type: 'NAVIGATE', path: '/app/recovery', label: 'weak topics' },
    }
  }

  // 5. Tests & Quizzes
  if (
    /\b(quiz|quizzes|test|tests|assessment)\b/i.test(lower) ||
    /(ಪರೀಕ್ಷೆ|ಟೆಸ್ಟ್)/.test(message) ||
    /(परीक्षा|टेस्ट)/.test(message) ||
    /(தேர்வு)/.test(message) ||
    /(పరీక్ష)/.test(message)
  ) {
    return {
      reply: NAVIGATION_REPLIES[lang]?.test || NAVIGATION_REPLIES.en.test,
      action: { type: 'NAVIGATE', path: '/app/quizzes', label: 'assessment' },
    }
  }

  // 6. Knowledge Graph & Graph Analysis
  if (
    /\b(analyse|analyze|analysis)\b/i.test(lower) ||
    /\b(knowledge graph|graph|concept map)\b/i.test(lower) ||
    /(ಜ್ಞಾನ ನಕ್ಷೆ|ನಕ್ಷೆ|ವಿಶ್ಲೇಷಿಸಿ|ವಿಶ್ಲೇಷಣೆ)/.test(message) ||
    /(ज्ञान ग्राफ|ग्राफ|विश्लेषण)/.test(message) ||
    /(அறிவு வரைபடம்|பகுப்பாய்வு)/.test(message) ||
    /(నాలెడ్జ్ గ్రాఫ్|విశ్లేషణ)/.test(message)
  ) {
    const isAnalyse =
      /\b(analyse|analyze|analysis)\b/i.test(lower) ||
      /(ವಿಶ್ಲೇಷಿಸಿ|ವಿಶ್ಲೇಷಣೆ|विश्लेषण|பகுப்பாய்வு|విశ్లేషణ)/.test(message)

    const path = isAnalyse ? '/app/graph?analyse=true' : '/app/graph'
    const replyText = isAnalyse
      ? ({
          en: 'Sure, analyzing your knowledge graph and identifying cognitive bottlenecks.',
          kn: 'ಖಂಡಿತ, ನಿಮ್ಮ ಜ್ಞಾನ ನಕ್ಷೆಯನ್ನು ವಿಶ್ಲೇಷಿಸಿ ಪ್ರಮುಖ ವಿಷಯಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ.',
          hi: 'ज़रूर, आपके ज्ञान ग्राफ का विश्लेषण कर प्रमुख बिंदुओं की पहचान की जा रही है।',
          ta: 'நிச்சயமாக, உங்கள் அறிவு வரைபடத்தை பகுப்பாய்வு செய்கிறேன்.',
          te: 'తప్పకుండా, మీ నాలెడ్జ్ గ్రాఫ్‌ను విశ్లేషిస్తున్నాను.',
        }[lang] || 'Sure, analyzing your knowledge graph and identifying cognitive bottlenecks.')
      : (NAVIGATION_REPLIES[lang]?.graph || NAVIGATION_REPLIES.en.graph)

    return {
      reply: replyText,
      action: { type: 'NAVIGATE', path, label: 'knowledge graph analysis' },
    }
  }

  // 7. Learning Path
  if (
    /\b(learning path|study path)\b/i.test(lower) ||
    /(ಕಲಿಕೆಯ ಹಾದಿ|ಮಾರ್ಗ)/.test(message) ||
    /(अध्ययन पथ)/.test(message) ||
    /(கற்றல் பாதை)/.test(message) ||
    /(లెర్నింగ్ పాత్)/.test(message)
  ) {
    return {
      reply: NAVIGATION_REPLIES[lang]?.path || NAVIGATION_REPLIES.en.path,
      action: { type: 'NAVIGATE', path: '/app/learning-path', label: 'learning path' },
    }
  }

  return null
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return []
  return history
    .filter((item) => (
      item && (item.role === 'user' || item.role === 'assistant') &&
      typeof item.text === 'string' && item.text.trim()
    ))
    .slice(-8)
    .map((item) => ({ role: item.role, content: item.text.trim().slice(0, 1000) }))
}

function contextFilter(context = {}) {
  const filter = { userId: context.userId }
  if (typeof context.documentId === 'string' && context.documentId.length <= 120) {
    filter.sources = { some: { documentId: context.documentId } }
  }
  return filter
}

export function createVoiceAgentService(prisma, { fetchImpl = globalThis.fetch } = {}) {
  return {
    chatWithVoiceAgent: async (userId, { message, context = {}, history = [] }) => {
      if (typeof message !== 'string' || !message.trim() || message.length > 2000) {
        throw new HttpError(400, 'Enter a question of 1 to 2000 characters.')
      }

      const cleanMessage = message.trim()
      const lower = cleanMessage.toLocaleLowerCase()
      const lang = detectLanguage(cleanMessage, context.language)

      // 1. Natural Conversational Greetings across all languages
      const isGreeting =
        /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)\b/i.test(cleanMessage) ||
        /^(ನಮಸ್ಕಾರ|ಹಾಯ್|ಹಲೋ|ಶುಭೋದಯ|ಶುಭ ಸಂಜೆ)/.test(cleanMessage) ||
        /^(नमस्ते|नमस्कार|हेलो|हाय|सुप्रभात)/.test(cleanMessage) ||
        /^(வணக்கம்|ஹலோ)/.test(cleanMessage) ||
        /^(నమస్కారం|హలో|శుభోదయం)/.test(cleanMessage)

      if (isGreeting && cleanMessage.split(/\s+/).length <= 5) {
        return {
          reply: GREETINGS[lang] || GREETINGS.en,
          action: null,
          language: lang,
        }
      }

      // 2. Multilingual Voice Navigation Commands
      const navAction = getNavigationAction(cleanMessage, lang)
      if (navAction) {
        return {
          ...navAction,
          language: lang,
        }
      }

      // 3. Explaining Topics or Concepts
      const isExplainQuery =
        /\b(explain|teach|tell me about|what is|meaning of|define)\b/i.test(lower) ||
        /(ವಿವರಿಸಿ|ಅರ್ಥವೇನು|ತಿಳಿಸಿ|ತಿಳಿಸು)/.test(cleanMessage) ||
        /(समझाओ|क्या है|का अर्थ|बताइए)/.test(cleanMessage) ||
        /(விளக்குங்கள்|என்றால் என்ன)/.test(cleanMessage) ||
        /(వివరించండి|అంటే ఏమిటి)/.test(cleanMessage)

      if (isExplainQuery) {
        // Check predefined concept translations
        for (const [key, details] of Object.entries(CONCEPT_EXPLANATIONS[lang] || {})) {
          if (lower.includes(key) || cleanMessage.includes(key)) {
            let replyText = `${details.meaning} ${details.example}`
            return {
              reply: replyText,
              action: null,
              language: lang,
            }
          }
        }

        // Check topic learning materials
        if (context.documentId && typeof prisma.topicLearningMaterial?.findMany === 'function') {
          const materials = await prisma.topicLearningMaterial.findMany({
            where: { documentId: context.documentId, userId },
            orderBy: { orderIndex: 'asc' },
          })
          if (materials.length > 0) {
            const mat = materials[0]
            let replyText = ''
            if (lang === 'kn') {
              replyText = `ನಾನು ${mat.topicTitle} ಬಗ್ಗೆ ಸರಳವಾಗಿ ವಿವರಿಸುತ್ತೇನೆ: ${mat.simpleDefinition} ${mat.easyExplanation} ನೈಜ ಉದಾಹರಣೆ: ${mat.realWorldExample || 'ಇದು ಹಂತ ಹಂತವಾಗಿ ಸಂಪರ್ಕಗೊಳ್ಳುತ್ತದೆ.'}`
            } else if (lang === 'hi') {
              replyText = `मैं ${mat.topicTitle} के बारे में संक्षेप में समझाता हूँ: ${mat.simpleDefinition} ${mat.easyExplanation} वास्तविक उदाहरण: ${mat.realWorldExample || 'यह कड़ियों की तरह परस्पर जुड़ा हुआ है।'}`
            } else {
              replyText = `I'll explain ${mat.topicTitle} in simple words: ${mat.simpleDefinition} ${mat.easyExplanation} Real-world example: ${mat.realWorldExample || 'It functions step-by-step like connected links.'}`
            }
            return {
              reply: replyText,
              action: null,
              language: lang,
            }
          }
        }
      }

      // 4. "I don't understand" / "Can you explain simpler?"
      if (
        /\b(i don'?t understand|more simple|simpler|easier example|give me an example)\b/i.test(lower) ||
        /(ಅರ್ಥವಾಗಲಿಲ್ಲ|ಸರಳವಾಗಿ|ಉದಾಹರಣೆ ನೀಡಿ)/.test(cleanMessage) ||
        /(समझ नहीं आया|सरल तरीके से|उदाहरण दो)/.test(cleanMessage)
      ) {
        let replyText = ''
        if (lang === 'kn') {
          replyText = 'ಯಾವುದೇ ಚಿಂತೆಯಿಲ್ಲ! ಇದನ್ನು ಸರಳ ಉದಾಹರಣೆಯ ಮೂಲಕ ನೋಡೋಣ. ಪ್ರತಿಯೊಂದು ಪರಿಕಲ್ಪನೆಯೂ ರೈಲಿನ ಬೋಗಿಗಳಂತೆ ಒಂದಕ್ಕೊಂದು ಜೋಡಿಸಲ್ಪಟ್ಟಿರುತ್ತದೆ. ಒಂದನ್ನು ಕಲಿತರೆ ಮುಂದಿನದು ಸುಲಭವಾಗುತ್ತದೆ.'
        } else if (lang === 'hi') {
          replyText = 'कोई बात नहीं! इसे एक सरल उदाहरण से समझते हैं। प्रत्येक अवधारणा रेल के डिब्बों की तरह एक-दूसरे से जुड़ी होती है। एक कदम समझने से अगला विषय बहुत आसान हो जाता है।'
        } else {
          replyText = 'No problem! Let me explain it using an easier example. Imagine each concept connects like railway carriages on a track: understanding the foundation makes the next part clear.'
        }
        return {
          reply: replyText,
          action: null,
          language: lang,
        }
      }

      // 5. Weak Concepts Query
      const concepts = typeof prisma.concept?.findMany === 'function'
        ? await prisma.concept.findMany({
            where: contextFilter({ ...context, userId }),
            include: {
              mastery: true,
              topics: { include: { topic: true } },
              sources: { select: { documentId: true, pageNumber: true, excerpt: true }, take: 2 },
            },
            take: 50,
          })
        : []

      if (
        (/\b(what|which|list|show)\b/i.test(lower) && /\b(weak|struggling|need to review)\b/i.test(lower)) ||
        /(ಕಷ್ಟಕರ|ಪುನರಾವರ್ತಿಸಬೇಕಾದ|कमजोर विषय)/.test(cleanMessage)
      ) {
        const weakConcepts = concepts.filter((c) => (
          c.mastery?.status === 'WEAK' || c.mastery?.status === 'REVISION_REQUIRED' || c.mastery?.status === 'LEARNING'
        ))
        let replyText = ''
        if (lang === 'kn') {
          replyText = weakConcepts.length
            ? `ಪರಿಷ್ಕರಣೆ ಮಾಡಬೇಕಾದ ಪ್ರಮುಖ ವಿಷಯಗಳು: ${weakConcepts.map((c) => c.name).join(', ')}. ಇವುಗಳನ್ನು ನೀವು ಸುಲಭವಾಗಿ ಸುಧಾರಿಸಬಹುದು.`
            : 'ಪ್ರಸ್ತುತ ಯಾವುದೇ ಕಷ್ಟಕರ ವಿಷಯಗಳು ಬಾಕಿ ಇಲ್ಲ. ನಿಮ್ಮ ಕಲಿಕೆ ಉತ್ತಮ ಪ್ರಗತಿಯಲ್ಲಿದೆ!'
        } else if (lang === 'hi') {
          replyText = weakConcepts.length
            ? `समीक्षा के लिए चिन्हित विषय: ${weakConcepts.map((c) => c.name).join(', ')}। इन्हें अभ्यास करके मजबूत किया जा सकता है।`
            : 'वर्तमान में कोई कमजोर विषय नहीं हैं। आपका अध्ययन अच्छी गति में है!'
        } else {
          replyText = weakConcepts.length
            ? `Topics marked for review: ${weakConcepts.map((c) => c.name).join(', ')}.`
            : 'There are no topics currently marked weak or needing revision in this learning context.'
        }
        return {
          reply: replyText,
          action: null,
          language: lang,
        }
      }

      // 6. External LLM Dispatch or Intelligent Fallback
      const apiKey = process.env.OPENAI_API_KEY
      const model = process.env.OPENAI_MODEL

      // If no external API key, synthesize grounded educational response in target language
      if (!apiKey || !model) {
        const matchingConcept = concepts.find((c) =>
          lower.includes(c.name.toLowerCase()) ||
          cleanMessage.includes(c.name)
        ) || concepts[0]

        let synthesizedReply = ''
        if (matchingConcept) {
          if (lang === 'kn') {
            synthesizedReply = `ನಿಮ್ಮ ದಾಖಲೆಯ ಪ್ರಕಾರ, ${matchingConcept.name} ಎಂಬುದು ಒಂದು ಪ್ರಮುಖ ವಿಷಯವಾಗಿದೆ. ${matchingConcept.simpleExplanation || matchingConcept.definition} ನೈಜ ಉದಾಹರಣೆ: ${(matchingConcept.examples && matchingConcept.examples[0]) || 'ಇದು ಗಣಿತ ಮತ್ತು ಕಂಪ್ಯೂಟರ್ ವಿಜ್ಞಾನದಲ್ಲಿ ನೇರವಾಗಿ ಅನ್ವಯವಾಗುತ್ತದೆ.'}`
          } else if (lang === 'hi') {
            synthesizedReply = `आपके दस्तावेज़ के अनुसार, ${matchingConcept.name} एक मुख्य अवधारणा है। ${matchingConcept.simpleExplanation || matchingConcept.definition} वास्तविक उदाहरण: ${(matchingConcept.examples && matchingConcept.examples[0]) || 'यह वास्तविक प्रणालियों और गणित में सीधे प्रयुक्त होता है।'}`
          } else if (lang === 'ta') {
            synthesizedReply = `உங்கள் ஆவணத்தின்படி, ${matchingConcept.name} ஒரு முக்கியமான பாடமாகும். ${matchingConcept.simpleExplanation || matchingConcept.definition}`
          } else if (lang === 'te') {
            synthesizedReply = `మీ డాక్యుమెంట్ ప్రకారం, ${matchingConcept.name} ఒక ముఖ్యమైన అంశం. ${matchingConcept.simpleExplanation || matchingConcept.definition}`
          } else {
            synthesizedReply = `According to your document, ${matchingConcept.name} is a key concept. ${matchingConcept.simpleExplanation || matchingConcept.definition} Real-world context: ${(matchingConcept.examples && matchingConcept.examples[0]) || 'It operates reliably as a foundational principle in this subject.'}`
          }
        } else {
          if (lang === 'kn') {
            synthesizedReply = `ನಿಮ್ಮ ಪ್ರಶ್ನೆ "${cleanMessage}" ಗೆ ಸಂಬಂಧಿಸಿದಂತೆ: ನಿಮ್ಮ ದಾಖಲೆಗಳು ಮತ್ತು ಕಲಿಕೆಯ ನಕ್ಷೆಯನ್ನು ಪರೀಕ್ಷಿಸಲಾಗಿದೆ. ನಿರ್ದಿಷ್ಟ ವಿಷಯ ಅಥವಾ ಅಧ್ಯಾಯದ ಬಗ್ಗೆ ಕೇಳಲು ಬಯಸಿದರೆ, ನಾನು ವಿವರವಾಗಿ ತಿಳಿಸಬಲ್ಲೆ.`
          } else if (lang === 'hi') {
            synthesizedReply = `आपके प्रश्न "${cleanMessage}" के संदर्भ में: आपकी अध्ययन सामग्री उपलब्ध है। आप किसी भी विशिष्ट विषय या अध्याय के बारे में पूछ सकते हैं।`
          } else {
            synthesizedReply = `Regarding your query "${cleanMessage}": I am here to help you navigate, understand key concepts, and test your knowledge across all uploaded materials.`
          }
        }

        return {
          reply: synthesizedReply,
          action: null,
          language: lang,
        }
      }

      // External API call if configured
      const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
      const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 30000)

      try {
        const response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature: 0.3,
            max_completion_tokens: 700,
            messages: [
              {
                role: 'system',
                content: `You are KNOWFLOW, a student learning assistant. Respond in ${lang === 'kn' ? 'Kannada' : lang === 'hi' ? 'Hindi' : lang === 'ta' ? 'Tamil' : lang === 'te' ? 'Telugu' : 'English'}. Answer clearly and briefly using the supplied concepts as the source of truth. Return only a JSON object with one string property named "reply".`,
              },
              {
                role: 'user',
                content: JSON.stringify({
                  question: cleanMessage,
                  language: lang,
                }),
              },
            ],
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        })

        if (response.ok) {
          const payload = await response.json()
          const result = JSON.parse(payload?.choices?.[0]?.message?.content || '{}')
          if (result.reply) {
            return { reply: result.reply.trim(), action: null, language: lang }
          }
        }
      } catch {}

      // Fallback response in target language
      return {
        reply: GREETINGS[lang] || GREETINGS.en,
        action: null,
        language: lang,
      }
    },
  }
}
