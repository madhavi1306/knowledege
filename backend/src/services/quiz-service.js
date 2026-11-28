import { HttpError } from '../utils/http-error.js'
import { inferCurriculumForDocument } from './curriculum-inference.js'

export function createQuizService(prisma) {
  return {
    /**
     * Generate adaptive quiz questions based on selected documents, topics, or weak concepts
     */
    createQuizSession: async (userId, { documentAnalysisId, mode = 'COMPREHENSIVE', questionCount = 5, targetConceptIds = [] }) => {
      // Find concepts to test
      const conceptWhere = { userId }
      if (targetConceptIds.length > 0) {
        conceptWhere.id = { in: targetConceptIds }
      } else if (mode === 'WEAK_ONLY') {
        conceptWhere.mastery = {
          status: { in: ['WEAK', 'REVISION_REQUIRED'] },
        }
      } else if (documentAnalysisId) {
        conceptWhere.sources = {
          some: { documentAnalysisId },
        }
      }

      let candidateConcepts = await prisma.concept.findMany({
        where: conceptWhere,
        include: {
          mastery: true,
          sources: { take: 1 },
          outgoingRelationships: {
            include: { toConcept: { select: { id: true, name: true } } },
          },
        },
        take: 30,
      })

      // If user requested WEAK_ONLY but has none, fallback to all concepts
      if (candidateConcepts.length === 0) {
        candidateConcepts = await prisma.concept.findMany({
          where: { userId },
          include: {
            mastery: true,
            sources: { take: 1 },
            outgoingRelationships: {
              include: { toConcept: { select: { id: true, name: true } } },
            },
          },
          take: 30,
        })
      }

      if (candidateConcepts.length === 0) {
        // Fallback: Check topic learning materials or uploaded documents
        let materials = []
        if (typeof prisma.topicLearningMaterial?.findMany === 'function') {
          materials = await prisma.topicLearningMaterial.findMany({
            where: { userId },
            take: 20,
          })
        }
        // Filter out any artificial single-filename materials
        const validMaterials = materials.filter((m) => !(m.simpleDefinition || '').includes('is a foundational concept described in this material'))

        if (validMaterials.length > 0) {
          candidateConcepts = validMaterials.map((m) => ({
            id: m.id,
            name: m.topicTitle,
            definition: m.simpleDefinition || m.easyExplanation || `Core principle of ${m.topicTitle}`,
            detailedExplanation: m.detailedExplanation || m.easyExplanation || m.simpleDefinition || '',
            mastery: { masteryScore: 50 },
            sources: [{ documentId: m.documentId }],
            outgoingRelationships: [],
          }))
        } else {
          let docs = []
          if (typeof prisma.document?.findMany === 'function') {
            docs = await prisma.document.findMany({ where: { userId }, take: 5 })
          }
          if (docs.length > 0) {
            const inferred = inferCurriculumForDocument(docs[0].fileName, docs[0].title, [])
            const curriculumTopics = inferred.chapters?.flatMap((ch) => ch.topics) || []

            if (curriculumTopics.length > 0) {
              candidateConcepts = curriculumTopics.map((t, idx) => ({
                id: `concept-inferred-${idx}`,
                name: t.name,
                definition: t.simpleDefinition,
                detailedExplanation: t.detailedExplanation,
                mastery: { masteryScore: 50 },
                sources: [{ documentId: docs[0].id }],
                outgoingRelationships: [],
              }))
            } else {
              candidateConcepts = [
                {
                  id: 'concept-relations',
                  name: 'Binary Relations & Cartesian Products',
                  definition: 'A binary relation between sets A and B is a subset of the Cartesian product A × B.',
                  detailedExplanation: 'Binary relations establish formal associations between elements of mathematical sets.',
                  mastery: { masteryScore: 50 },
                  sources: [],
                  outgoingRelationships: [],
                },
                {
                  id: 'concept-equivalence',
                  name: 'Equivalence Relations & Classes',
                  definition: 'A relation that is simultaneously reflexive, symmetric, and transitive, partitioning a set into equivalence classes.',
                  detailedExplanation: 'Equivalence relations group elements that share an invariant mathematical property.',
                  mastery: { masteryScore: 50 },
                  sources: [],
                  outgoingRelationships: [],
                },
              ]
            }
          } else {
            candidateConcepts = [
              {
                id: 'concept-foundations',
                name: 'Foundational Knowledge',
                definition: 'The fundamental principles and core theories that underpin a subject.',
                detailedExplanation: 'Foundational knowledge provides the framework for learning advanced topics.',
                mastery: { masteryScore: 50 },
                sources: [],
                outgoingRelationships: [],
              },
              {
                id: 'concept-analysis',
                name: 'Critical Analysis',
                definition: 'The ability to examine information, break it into components, and evaluate its validity.',
                detailedExplanation: 'Critical analysis allows learners to distinguish evidence from assumptions.',
                mastery: { masteryScore: 50 },
                sources: [],
                outgoingRelationships: [],
              },
            ]
          }
        }
      }

      // Shuffle and pick concepts
      const shuffled = [...candidateConcepts].sort(() => 0.5 - Math.random())
      const selected = shuffled.slice(0, Math.min(questionCount, shuffled.length))

      // Generate varied question types and difficulty
      const questionTypes = [
        'MULTIPLE_CHOICE',
        'TRUE_FALSE',
        'FILL_IN_BLANKS',
        'APPLICATION',
        'SCENARIO',
        'COMPARISON',
      ]

      const generatedQuestions = []

      for (let i = 0; i < selected.length; i++) {
        const concept = selected[i]
        const type = questionTypes[i % questionTypes.length]
        const masteryScore = concept.mastery?.masteryScore || 0

        // Adaptive difficulty based on mastery
        let difficulty = 'EASY'
        if (masteryScore >= 70) difficulty = 'DIFFICULT'
        else if (masteryScore >= 40) difficulty = 'MEDIUM'
        if (type === 'APPLICATION') difficulty = 'APPLICATION'
        if (type === 'SCENARIO') difficulty = 'ANALYTICAL'

        const otherConcepts = candidateConcepts.filter((c) => c.id !== concept.id).map((c) => c.name)

        if (type === 'MULTIPLE_CHOICE') {
          const distractors = otherConcepts.slice(0, 3)
          while (distractors.length < 3) {
            distractors.push(`Alternative construct ${distractors.length + 1}`)
          }
          const options = [concept.name, ...distractors].sort(() => 0.5 - Math.random())

          generatedQuestions.push({
            conceptId: concept.id,
            conceptName: concept.name,
            type: 'MULTIPLE_CHOICE',
            difficulty,
            questionText: `Which concept is defined as: "${concept.definition}"?`,
            options,
            correctAnswer: concept.name,
            explanation: `${concept.name} is defined as: ${concept.definition}. ${concept.detailedExplanation.slice(0, 200)}...`,
          })
        } else if (type === 'TRUE_FALSE') {
          const isTrue = Math.random() > 0.4
          const statement = isTrue
            ? `${concept.name}: ${concept.definition}`
            : `${concept.name} completely negates and excludes the function of ${otherConcepts[0] || 'fundamental components'}.`

          generatedQuestions.push({
            conceptId: concept.id,
            conceptName: concept.name,
            type: 'TRUE_FALSE',
            difficulty,
            questionText: `True or False: ${statement}`,
            options: ['True', 'False'],
            correctAnswer: isTrue ? 'True' : 'False',
            explanation: isTrue
              ? `Correct. ${concept.name} is indeed defined as: ${concept.definition}`
              : `False. In reality, ${concept.definition}`,
          })
        } else if (type === 'FILL_IN_BLANKS') {
          const words = concept.definition.split(' ')
          const keyWord = words.find((w) => w.length > 5 && !w.includes('.')) || concept.name
          const maskedDef = concept.definition.replace(new RegExp(`\\b${keyWord}\\b`, 'i'), '_______')

          const blankOptions = [keyWord, ...otherConcepts.slice(0, 3)].sort(() => 0.5 - Math.random())

          generatedQuestions.push({
            conceptId: concept.id,
            conceptName: concept.name,
            type: 'FILL_IN_BLANKS',
            difficulty,
            questionText: `Fill in the blank: "${maskedDef}"`,
            options: blankOptions,
            correctAnswer: keyWord,
            explanation: `The missing term is "${keyWord}". Complete definition: ${concept.definition}`,
          })
        } else if (type === 'APPLICATION' || type === 'SCENARIO') {
          const example = concept.examples?.[0] || concept.realLifeExample || 'a production system needing structured organization'
          const options = [
            `Utilize ${concept.name} to solve the core requirement directly.`,
            `Ignore ${concept.name} and bypass foundational guarantees.`,
            `Substitute with an unrelated construct without verification.`,
            `Arbitrarily restructure without considering prerequisites.`,
          ].sort(() => 0.5 - Math.random())

          generatedQuestions.push({
            conceptId: concept.id,
            conceptName: concept.name,
            type: type === 'SCENARIO' ? 'SCENARIO' : 'APPLICATION',
            difficulty,
            questionText: `Scenario: In an engineering workflow involving ${example}, what is the most appropriate architectural application of ${concept.name}?`,
            options,
            correctAnswer: `Utilize ${concept.name} to solve the core requirement directly.`,
            explanation: `When dealing with ${example}, ${concept.name} provides the essential structure: ${concept.detailedExplanation.slice(0, 180)}...`,
          })
        } else {
          // COMPARISON or SHORT_ANSWER
          const compareWith = otherConcepts[0] || 'Standard baseline'
          const options = [
            `${concept.name} specifically focuses on ${concept.definition.slice(0, 80)}, whereas ${compareWith} serves a different domain objective.`,
            `Both are completely identical with no operational distinction.`,
            `${concept.name} is obsolete and replaced universally.`,
            `Neither applies to real-world knowledge systems.`,
          ]

          generatedQuestions.push({
            conceptId: concept.id,
            conceptName: concept.name,
            type: 'COMPARISON',
            difficulty: 'ANALYTICAL',
            questionText: `Compare ${concept.name} with ${compareWith}. What distinguishes their roles?`,
            options,
            correctAnswer: options[0],
            explanation: `${concept.name} is characterized by: ${concept.definition}`,
          })
        }
      }

      // Create QuizSession in DB
      const session = await prisma.quizSession.create({
        data: {
          userId,
          documentAnalysisId: documentAnalysisId || null,
          mode,
          totalQuestions: generatedQuestions.length,
          questions: {
            create: generatedQuestions,
          },
        },
        include: {
          questions: true,
        },
      })

      return session
    },

    /**
     * Submit answers for evaluation and calculate comprehensive metrics
     */
    submitQuizSession: async (userId, quizSessionId, answers) => {
      const session = await prisma.quizSession.findFirst({
        where: { id: quizSessionId, userId },
        include: { questions: true },
      })

      if (!session) {
        throw new HttpError(404, 'Quiz session not found.')
      }

      let correctCount = 0
      const conceptResults = new Map() // conceptId -> { total, correct, name }

      for (const question of session.questions) {
        const userAnswer = (answers[question.id] || '').trim()
        const isCorrect = userAnswer.toLowerCase() === question.correctAnswer.trim().toLowerCase()
        if (isCorrect) correctCount++

        // Update question record
        await prisma.quizQuestion.update({
          where: { id: question.id },
          data: {
            userAnswer,
            isCorrect,
            gapAnalysis: isCorrect
              ? 'Concept accurately understood.'
              : `Knowledge gap detected in understanding the core properties and distinction of ${question.conceptName}.`,
          },
        })

        // Track per-concept performance
        if (question.conceptId) {
          const stats = conceptResults.get(question.conceptId) || {
            conceptId: question.conceptId,
            name: question.conceptName,
            total: 0,
            correct: 0,
          }
          stats.total++
          if (isCorrect) stats.correct++
          conceptResults.set(question.conceptId, stats)
        }
      }

      const scorePercentage = session.questions.length > 0
        ? Math.round((correctCount / session.questions.length) * 100)
        : 0

      const weakConcepts = []
      const strongConcepts = []
      const conceptBreakdown = []

      for (const [conceptId, stats] of conceptResults.entries()) {
        const ratio = stats.correct / stats.total
        let status = 'WEAK'
        let scoreDelta = -20
        if (ratio >= 0.8) {
          status = 'MASTERED'
          scoreDelta = 25
          strongConcepts.push(stats.name)
        } else if (ratio >= 0.5) {
          status = 'IMPROVING'
          scoreDelta = 10
        } else {
          weakConcepts.push(stats.name)
        }

        conceptBreakdown.push({
          conceptId,
          conceptName: stats.name,
          scorePercentage: Math.round(ratio * 100),
          status,
        })

        // Update ConceptMastery in DB
        const existingMastery = await prisma.conceptMastery.findUnique({
          where: { conceptId },
        })

        const newScore = existingMastery
          ? Math.min(100, Math.max(0, existingMastery.masteryScore + scoreDelta))
          : Math.max(0, scoreDelta > 0 ? 60 : 25)

        await prisma.conceptMastery.upsert({
          where: { conceptId },
          create: {
            userId,
            conceptId,
            status: ratio >= 0.8 ? 'MASTERED' : ratio >= 0.5 ? 'IMPROVING' : 'WEAK',
            masteryScore: newScore,
            totalAttempts: 1,
            correctAttempts: stats.correct,
            lastAssessedAt: new Date(),
          },
          update: {
            status: ratio >= 0.8 ? 'MASTERED' : ratio >= 0.5 ? 'IMPROVING' : 'WEAK',
            masteryScore: newScore,
            totalAttempts: { increment: stats.total },
            correctAttempts: { increment: stats.correct },
            lastAssessedAt: new Date(),
          },
        })
      }

      // Check if automatic recovery session should be triggered for weak concepts
      let recoverySessionId = null
      if (weakConcepts.length > 0) {
        const recoverySession = await prisma.recoverySession.create({
          data: {
            userId,
            quizSessionId: session.id,
            status: 'IN_PROGRESS',
            weakConceptNames: weakConcepts,
            steps: {
              create: weakConcepts.map((name, index) => ({
                conceptName: name,
                stepOrder: index + 1,
                status: 'PENDING',
                approachUsed: index % 2 === 0 ? 'ANALOGY' : 'STEP_BY_STEP',
              })),
            },
          },
        })
        recoverySessionId = recoverySession.id
      }

      const evaluationSummary = {
        totalScore: correctCount,
        totalQuestions: session.questions.length,
        scorePercentage,
        weakConcepts,
        strongConcepts,
        conceptBreakdown,
        recoverySessionId,
        recommendation: weakConcepts.length > 0
          ? `Identified ${weakConcepts.length} weak concept(s). Automatic recovery sequence initiated.`
          : 'Outstanding performance! All tested concepts demonstrate high retention.',
      }

      const updatedSession = await prisma.quizSession.update({
        where: { id: quizSessionId },
        data: {
          scorePercentage,
          completed: true,
          completedAt: new Date(),
          weakConceptNames: weakConcepts,
          strongConceptNames: strongConcepts,
          evaluationSummary,
        },
        include: {
          questions: true,
          recoverySession: true,
        },
      })

      return updatedSession
    },

    getQuizSession: async (userId, quizSessionId) => {
      const session = await prisma.quizSession.findFirst({
        where: { id: quizSessionId, userId },
        include: {
          questions: true,
          recoverySession: {
            include: { steps: true },
          },
        },
      })
      if (!session) throw new HttpError(404, 'Quiz session not found.')
      return session
    },

    listQuizSessions: async (userId) => {
      return prisma.quizSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          _count: { select: { questions: true } },
        },
      })
    },
  }
}
