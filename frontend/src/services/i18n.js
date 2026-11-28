/**
 * KNOWFLOW Multilingual & Audio Speech Engine
 * Supports English, Kannada (ಕನ್ನಡ), Hindi (हिन्दी), Tamil (தமிழ்), Telugu (తెలుగు)
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', voiceLang: 'en-US' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', voiceLang: 'kn-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', voiceLang: 'hi-IN' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', voiceLang: 'ta-IN' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', voiceLang: 'te-IN' },
]

// Common educational UI phrases & conceptual templates
const TRANSLATIONS = {
  kn: {
    'Interactive Knowledge Graph': 'ಸಂವಾದಾತ್ಮಕ ಜ್ಞಾನ ನಕ್ಷೆ (Knowledge Graph)',
    'Explore concepts, visualize dependencies, and identify weak spots in your mental model.': 'ಪರಿಕಲ್ಪನೆಗಳನ್ನು ಅನ್ವೇಷಿಸಿ, ಪರಸ್ಪರ ಸಂಬಂಧಗಳನ್ನು ವೀಕ್ಷಿಸಿ ಮತ್ತು ಕಷ್ಟಕರ ವಿಷಯಗಳನ್ನು ಸುಲಭವಾಗಿ ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ.',
    'Simple Meaning': 'ಸರಳ ಅರ್ಥ (Simple Meaning)',
    'Real-World Example': 'ನೈಜ ಉದಾಹರಣೆ (Example)',
    'Detailed Explanation': 'ವಿವರವಾದ ವಿವರಣೆ',
    'Listen': 'ಆಲಿಸಿ (Listen)',
    'Stop': 'ನಿಲ್ಲಿಸಿ',
    'Basic to Advanced Learning Journey': 'ಹಂತ ಹಂತದ ಕಲಿಕೆ: ಮೂಲಭೂತದಿಂದ ಮುಂದುವರಿದ ಹಂತದವರೆಗೆ',
    'Level 1: Foundational / Basic': 'ಹಂತ ೧: ಮೂಲಭೂತ ಪರಿಕಲ್ಪನೆಗಳು (Basic)',
    'Level 2: Intermediate / Core Mechanics': 'ಹಂತ ೨: ಮಧ್ಯಂತರ ಮತ್ತು ಕಾರ್ಯವಿಧಾನ (Intermediate)',
    'Level 3: Advanced / Exam Mastery': 'ಹಂತ ೩: ಮುಂದುವರಿದ ಹಂತ & ಪರೀಕ್ಷಾ ಪಾಂಡಿತ್ಯ (Advanced)',
    'Analyse Knowledge Graph': 'ಜ್ಞಾನ ನಕ್ಷೆಯ ವಿಶ್ಲೇಷಣೆ (Graph Analysis)',
    'Visual Graph Map': 'ದೃಶ್ಯ ನಕ್ಷೆ (Visual Map)',
    'Concept Matrix': 'ಪರಿಕಲ್ಪನೆಗಳ ಪಟ್ಟಿ (Matrix)',
    'prerequisite': 'ಮೊದಲು ಕಲಿಯಬೇಕಾದದ್ದು (Prerequisite)',
    'builds on': 'ಮುಂದುವರಿದ ಭಾಗ (Builds On)',
    'relates to': 'ಸಂಬಂಧಿಸಿದೆ (Relates To)',
    'Mastered': 'ಪರಿಪೂರ್ಣ (Mastered)',
    'Improving': 'ಸುಧಾರಿಸುತ್ತಿದೆ (Improving)',
    'Learning': 'ಕಲಿಯಲಾಗುತ್ತಿದೆ (Learning)',
    'Needs Focus': 'ಹೆಚ್ಚು ಗಮನ ಅಗತ್ಯ (Needs Focus)',
    'Start Learning': 'ಕಲಿಯಲು ಪ್ರಾರಂಭಿಸಿ',
    'Test Understanding': 'ಪರೀಕ್ಷೆ ತೆಗೆದುಕೊಳ್ಳಿ',
    'Import URL / Video Link': 'ವೀಡಿಯೊ ಅಥವಾ ವೆಬ್ ಲಿಂಕ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ',
    'Enter YouTube or website URL': 'YouTube ವೀಡಿಯೊ ಅಥವಾ ವೆಬ್‌ಸೈಟ್ ಲಿಂಕ್ ನಮೂದಿಸಿ',
    'Topic-Wise Knowledge Graph': 'ವಿಷಯವಾರು ಜ್ಞಾನ ನಕ್ಷೆ (Topic-Wise Graph)',
  },
  hi: {
    'Interactive Knowledge Graph': 'इंटरैक्टिव ज्ञान ग्राफ (Knowledge Graph)',
    'Explore concepts, visualize dependencies, and identify weak spots in your mental model.': 'अवधारणाओं को समझें, निर्भरताओं को देखें और कमजोर विषयों को मजबूत करें।',
    'Simple Meaning': 'सरल अर्थ (Simple Meaning)',
    'Real-World Example': 'वास्तविक उदाहरण (Example)',
    'Detailed Explanation': 'विस्तृत व्याख्या',
    'Listen': 'सुनें (Listen)',
    'Stop': 'रोकें',
    'Basic to Advanced Learning Journey': 'चरण-दर-चरण अध्ययन: बुनियादी से उन्नत स्तर तक',
    'Level 1: Foundational / Basic': 'स्तर १: बुनियादी अवधारणाएँ (Basic)',
    'Level 2: Intermediate / Core Mechanics': 'स्तर २: प्रक्रिया और नियम (Intermediate)',
    'Level 3: Advanced / Exam Mastery': 'स्तर ३: उन्नत स्तर एवं परीक्षा तैयारी (Advanced)',
    'Analyse Knowledge Graph': 'ग्राफ का विश्लेषण (Graph Analysis)',
    'Visual Graph Map': 'दृश्य मानचित्र (Visual Map)',
    'Concept Matrix': 'अवधारणा सूची (Matrix)',
    'prerequisite': 'पूर्वापेक्षा (Prerequisite)',
    'builds on': 'आगे का भाग (Builds On)',
    'relates to': 'संबंधित (Relates To)',
    'Mastered': 'कुशल (Mastered)',
    'Improving': 'सुधार जारी (Improving)',
    'Learning': 'प्रगति पर (Learning)',
    'Needs Focus': 'ध्यान आवश्यक (Needs Focus)',
    'Start Learning': 'पढ़ना शुरू करें',
    'Test Understanding': 'परीक्षण दें',
    'Import URL / Video Link': 'वीडियो या वेब लिंक अपलोड करें',
    'Enter YouTube or website URL': 'YouTube वीडियो या वेबसाइट लिंक दर्ज करें',
    'Topic-Wise Knowledge Graph': 'विषयवार ज्ञान ग्राफ (Topic-Wise Graph)',
  },
  ta: {
    'Interactive Knowledge Graph': 'ஊடாடும் அறிவு வரைபடம் (Knowledge Graph)',
    'Explore concepts, visualize dependencies, and identify weak spots in your mental model.': 'கருத்துகளை ஆராய்ந்து, தொடர்புகளைக் காட்சிப்படுத்தி, கடினமான பாடங்களை எளிதில் கற்றுக்கொள்ளுங்கள்.',
    'Simple Meaning': 'எளிய பொருள் (Simple Meaning)',
    'Real-World Example': 'நிஜ வாழ்க்கை உதாரணம் (Example)',
    'Detailed Explanation': 'விரிவான விளக்கம்',
    'Listen': 'கேளுங்கள் (Listen)',
    'Stop': 'நிறுத்து',
    'Basic to Advanced Learning Journey': 'படி-படியான கற்றல்: அடிப்படைகள் முதல் மேம்பட்ட நிலை வரை',
    'Level 1: Foundational / Basic': 'நிலை 1: அடிப்படை கருத்துகள் (Basic)',
    'Level 2: Intermediate / Core Mechanics': 'நிலை 2: செயல்பாடுகள் & செயல்முறைகள் (Intermediate)',
    'Level 3: Advanced / Exam Mastery': 'நிலை 3: மேம்பட்ட நிலை & தேர்வு தயாரிப்பு (Advanced)',
    'Analyse Knowledge Graph': 'வரைபட பகுப்பாய்வு (Graph Analysis)',
    'Visual Graph Map': 'காட்சி வரைபடம் (Visual Map)',
    'Concept Matrix': 'கருத்து அணி (Matrix)',
    'prerequisite': 'முன் தேவை (Prerequisite)',
    'builds on': 'தொடர்ச்சி (Builds On)',
    'relates to': 'தொடர்புடையது (Relates To)',
    'Mastered': 'நிறைவு (Mastered)',
    'Improving': 'முன்னேற்றம் (Improving)',
    'Learning': 'கற்றல் (Learning)',
    'Needs Focus': 'கவனம் தேவை (Needs Focus)',
    'Start Learning': 'கற்கத் தொடங்குங்கள்',
    'Test Understanding': 'பரிசோதனை செய்யுங்கள்',
    'Import URL / Video Link': 'வீடியோ அல்லது இணைய இணைப்பு பதிவேற்றவும்',
    'Enter YouTube or website URL': 'YouTube வீடியோ அல்லது இணைய இணைப்பை உள்ளிடவும்',
    'Topic-Wise Knowledge Graph': 'பாடம் சார்ந்த அறிவு வரைபடம் (Topic-Wise Graph)',
  },
  te: {
    'Interactive Knowledge Graph': 'ఇంటరాక్టివ్ నాలెడ్జ్ గ్రాఫ్ (Knowledge Graph)',
    'Explore concepts, visualize dependencies, and identify weak spots in your mental model.': 'కాన్సెప్ట్‌లను అన్వేషించండి, సంబంధాలను వీక్షించండి మరియు బలహీనమైన అంశాలను సులభంగా నేర్చుకోండి.',
    'Simple Meaning': 'సులభమైన అర్థం (Simple Meaning)',
    'Real-World Example': 'నిజ జీవిత ఉదాహరణ (Example)',
    'Detailed Explanation': 'వివరణాత్మక వివరణ',
    'Listen': 'వినండి (Listen)',
    'Stop': 'ఆపండి',
    'Basic to Advanced Learning Journey': 'దశలవారీ అభ్యాసం: ప్రాథమిక నుండి అధునాతన స్థాయి వరకు',
    'Level 1: Foundational / Basic': 'స్థాయి 1: ప్రాథమిక అంశాలు (Basic)',
    'Level 2: Intermediate / Core Mechanics': 'స్థాయి 2: మధ్యస్థ స్థాయి & పద్ధతులు (Intermediate)',
    'Level 3: Advanced / Exam Mastery': 'స్థాయి 3: అధునాతన స్థాయి & పరీక్ష నైపుణ్యం (Advanced)',
    'Analyse Knowledge Graph': 'గ్రాఫ్ విశ్లేషణ (Graph Analysis)',
    'Visual Graph Map': 'విజువల్ మ్యాప్ (Visual Map)',
    'Concept Matrix': 'కాన్సెప్ట్ మ్యాట్రిక్స్ (Matrix)',
    'prerequisite': 'ముందస్తు అవసరం (Prerequisite)',
    'builds on': 'కొనసాగింపు (Builds On)',
    'relates to': 'సంబంధించినది (Relates To)',
    'Mastered': 'నైపుణ్యం (Mastered)',
    'Improving': 'మెరుగుపడుతోంది (Improving)',
    'Learning': 'నేర్చుకుంటున్నారు (Learning)',
    'Needs Focus': 'దృష్టి అవసరం (Needs Focus)',
    'Start Learning': 'నేర్చుకోవడం ప్రారంభించండి',
    'Test Understanding': 'పరీక్ష రాయండి',
    'Import URL / Video Link': 'వీడియో లేదా వెబ్ లింక్ అప్‌లోడ్ చేయండి',
    'Enter YouTube or website URL': 'YouTube వీడియో లేదా వెబ్‌సైట్ లింక్‌ను నమోదు చేయండి',
    'Topic-Wise Knowledge Graph': 'టాపిక్ వారీ నాలెడ్జ్ గ్రాఫ్ (Topic-Wise Graph)',
  },
}

// Domain-specific concept translations for math / computer science
const CONCEPT_TRANSLATIONS = {
  kn: {
    'Cartesian Products & Binary Relations': {
      meaning: 'ಎರಡು ಸೆಟ್‌ಗಳಿಂದ ಜೋಡಿಗಳನ್ನು (pairs) ತಯಾರಿಸುವ ವಿಧಾನ. ಬಟ್ಟೆ ಮತ್ತು ಪ್ಯಾಂಟ್ ಜೋಡಿಯಂತೆ ಪ್ರತಿಯೊಂದು ಸಾಧ್ಯತೆಯನ್ನು ಪರಿಶೀಲಿಸುವುದು.',
      summary: 'ಮೂಲಭೂತ ಗಣಿತ ಸಂಬಂಧಗಳು: ಸೆಟ್ A ಮತ್ತು ಸೆಟ್ B ನಡುವಿನ ಜೋಡಿಗಳ ಸಂಗ್ರಹ.',
    },
    'Matrix & Digraph Representation of Relations': {
      meaning: 'ಸಂಬಂಧಗಳನ್ನು 1 ಮತ್ತು 0 ಗಳ ಕೋಷ್ಟಕದಲ್ಲಿ (Matrix) ಅಥವಾ ಬಾಣದ ಗುರುತುಗಳ ನಕ್ಷೆಯಲ್ಲಿ (Digraph) ಪ್ರದರ್ಶಿಸುವುದು.',
      summary: 'ದೃಶ್ಯ ನಕ್ಷೆ: ಬಿಂದುಗಳು ಮತ್ತು ಸಂಪರ್ಕಿಸುವ ಬಾಣದ ಗುರುತುಗಳ ಮೂಲಕ ಸಂಬಂಧಗಳನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ತೋರಿಸುತ್ತದೆ.',
    },
    'Reflexive and Symmetric Relations': {
      meaning: 'ಪ್ರತಿಯೊಂದು ಅಂಶವು ತನ್ನೊಂದಿಗೇ ಸಂಬಂಧ ಹೊಂದಿದ್ದರೆ ಅದು Reflexive. A ಗೆ B ಸಂಬಂಧಿಸಿದಾಗ B ಕೂಡ A ಗೆ ಸಂಬಂಧಿಸಿದರೆ ಅದು Symmetric.',
      summary: 'ಕನ್ನಡಿಯ ಪ್ರತಿಬಿಂಬ (Reflexive) ಮತ್ತು ಪರಸ್ಪರ ಸ್ನೇಹದಂತೆ (Symmetric).',
    },
    'Antisymmetric and Transitive Relations': {
      meaning: 'Transitive ಎಂದರೆ A ಇಂದ B ಗೆ ಮತ್ತು B ಇಂದ C ಗೆ ದಾರಿಯಿದ್ದರೆ, ನೇರವಾಗಿ A ಇಂದ C ಗೆ ದಾರಿ ಇರುತ್ತದೆ.',
      summary: 'ಪರೋಕ್ಷ ಸಂಪರ್ಕ ಮತ್ತು ಶ್ರೇಣೀಕೃತ ಕ್ರಮ.',
    },
    'Equivalence Relations & Equivalence Classes': {
      meaning: 'Reflexive, Symmetric ಮತ್ತು Transitive ಮೂರನ್ನೂ ಪಾಲಿಸುವ ಪರಿಪೂರ್ಣ ಸಮಾನತೆಯ ಸಂಬಂಧ.',
      summary: 'ವಸ್ತುಗಳನ್ನು ಸಮಾನ ಗುಂಪುಗಳಾಗಿ (Equivalence Classes) ವಿಂಗಡಿಸುತ್ತದೆ.',
    },
    'Partial Orders and Posets': {
      meaning: 'ವಸ್ತುಗಳನ್ನು ಒಂದು ನಿರ್ದಿಷ್ಟ ಕ್ರಮದಲ್ಲಿ (Order) ಜೋಡಿಸುವ ಗಣಿತೀಯ ವಿಧಾನ. ಉದಾಹರಣೆಗೆ: ಕೆಲಸಗಳ ಆದ್ಯತೆ.',
      summary: 'Poset: ಅಂಶಗಳನ್ನು ಕ್ರಮಬದ್ಧವಾಗಿ ಜೋಡಿಸಲು ಬಳಸುವ ಗಣಿತ ಚೌಕಟ್ಟು.',
    },
    'Hasse Diagrams & Topological Sorting': {
      meaning: 'ಅನಗತ್ಯ ಲೂಪ್‌ಗಳನ್ನು ತೆಗೆದು ನೇರವಾಗಿ ಕೆಳಗಿನಿಂದ ಮೇಲಕ್ಕೆ ಚಿತ್ರಿಸುವ ಸುಲಭವಾದ ನಕ್ಷೆ.',
      summary: 'Hasse Diagram: Poset ಅನ್ನು ಸರಳ ರೇಖಾಚಿತ್ರದ ಮೂಲಕ ನೋಡಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.',
    },
  },
  hi: {
    'Cartesian Products & Binary Relations': {
      meaning: 'दो समूहों (Sets) से जोड़ों (Pairs) को बनाने की विधि। हर संभावित संयोजन को चुनना।',
      summary: 'सेट A और B के बीच सभी संभावित जोड़े और उनके संबंध।',
    },
    'Matrix & Digraph Representation of Relations': {
      meaning: 'संबंधों को 1 और 0 की तालिका (Matrix) या तीरों वाले ग्राफ (Digraph) में दर्शाना।',
      summary: 'संबंधों का दृश्य और मैट्रिक्स रूप में निरूपण।',
    },
    'Reflexive and Symmetric Relations': {
      meaning: 'प्रत्येक तत्व का स्वयं से संबंध (Reflexive) और दोनों तरफ का परस्पर संबंध (Symmetric)।',
      summary: 'दर्पण प्रतिबिंब और आपसी मित्रता का गणितीय नियम।',
    },
    'Antisymmetric and Transitive Relations': {
      meaning: 'यदि A से B और B से C का संबंध है, तो A से C का भी संबंध होना Transitive कहलाता है।',
      summary: 'कड़ियों की शृंखला द्वारा सीधा संबंध स्थापित करना।',
    },
    'Equivalence Relations & Equivalence Classes': {
      meaning: 'जो संबंध Reflexive, Symmetric और Transitive तीनों हो, वह Equivalence Relation है।',
      summary: 'समूह को समान वर्गों (Partitions) में विभाजित करता है।',
    },
    'Partial Orders and Posets': {
      meaning: 'तत्वों को एक व्यवस्थित क्रम (Order) में रखने का नियम।',
      summary: 'Poset: प्राथमिकताओं और पदानुक्रम को व्यवस्थित करता है।',
    },
    'Hasse Diagrams & Topological Sorting': {
      meaning: 'अनावश्यक तीरों को हटाकर नीचे से ऊपर की ओर बनने वाला सरल एवं स्पष्ट चित्र।',
      summary: 'Hasse Diagram: जटिल संबंधों को सरलता से देखने का आरेख।',
    },
  },
}

export function t(phrase, lang = 'en') {
  if (lang === 'en' || !lang) return phrase
  return TRANSLATIONS[lang]?.[phrase] || phrase
}

export function getConceptTranslation(conceptName, originalMeaning, lang = 'en') {
  if (lang === 'en' || !lang) return originalMeaning

  const match = CONCEPT_TRANSLATIONS[lang]?.[conceptName]
  if (match?.meaning) {
    return `${match.meaning} (${originalMeaning})`
  }

  // Fallback prefix for other concepts
  if (lang === 'kn') {
    return `[ಕನ್ನಡ ವಿವರಣೆ]: ${originalMeaning}`
  } else if (lang === 'hi') {
    return `[सरल हिंदी विवरण]: ${originalMeaning}`
  }

  return originalMeaning
}

export function speakInLanguage(text, lang = 'en', onStart, onEnd) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return

  try {
    window.speechSynthesis.cancel()
    if (window.speechSynthesis.paused) window.speechSynthesis.resume()

    const clean = text.replace(/[*_#`~\[\]\(\)]/g, '').replace(/https?:\/\/\S+/g, '').trim()
    if (!clean) return

    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.rate = 0.95
    utterance.pitch = 1.0

    const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0]
    utterance.lang = langConfig.voiceLang

    const voices = window.speechSynthesis.getVoices()
    const matchingVoice = voices.find((v) => v.lang.startsWith(lang) || v.lang.includes(langConfig.voiceLang))
    if (matchingVoice) {
      utterance.voice = matchingVoice
    }

    if (onStart) utterance.onstart = onStart
    if (onEnd) {
      utterance.onend = onEnd
      utterance.onerror = onEnd
    }

    window._activeUtterance = utterance
    window.speechSynthesis.speak(utterance)
  } catch (err) {
    console.warn('SpeechSynthesis notice:', err)
    if (onEnd) onEnd()
  }
}
