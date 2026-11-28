import { HttpError } from '../utils/http-error.js'

export function createRecoveryService(prisma) {
  return {
    getRecoverySession: async (userId, recoveryId) => {
      const session = await prisma.recoverySession.findFirst({
        where: { id: recoveryId, userId },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      })
      if (!session) throw new HttpError(404, 'Recovery session not found.')
      return session
    },

    listActiveRecoverySessions: async (userId) => {
      return prisma.recoverySession.findMany({
        where: { userId },
        include: { steps: true },
        orderBy: { createdAt: 'desc' },
      })
    },

    /**
     * Reteach a weak concept using a specialized approach (Analogy, Step-by-Step, Visual/Concrete)
     */
    reteachStep: async (userId, recoveryId, stepId, approach = 'ANALOGY') => {
      const step = await prisma.recoveryStep.findFirst({
        where: { id: stepId, recoverySessionId: recoveryId },
        include: { recoverySession: true },
      })
      if (!step || step.recoverySession.userId !== userId) {
        throw new HttpError(404, 'Recovery step not found.')
      }

      // Find the concept
      const concept = await prisma.concept.findFirst({
        where: { userId, name: step.conceptName },
        include: {
          outgoingRelationships: {
            where: { type: 'PREREQUISITE' },
            include: { toConcept: true },
          },
        },
      })

      const prerequisiteNames = concept?.outgoingRelationships.map((r) => r.toConcept.name) || []

      // Generate multi-approach pedagogical explanation
      let reteachContent = {}
      if (approach === 'ANALOGY') {
        reteachContent = {
          approach: 'ANALOGY',
          headline: `Understanding ${step.conceptName} through a Familiar Analogy`,
          mainAnalogy: concept?.analogy || `Imagine an airport control tower coordinating flight paths seamlessly so no two planes collide. That is exactly what ${step.conceptName} manages in its domain.`,
          whyItWorks: `Instead of focusing on abstract definitions, notice how the central coordinating rule prevents bottleneck failures.`,
          realWorldApplication: concept?.realLifeExample || `In distributed databases, this maintains consistent replicas without manual intervention.`,
          commonMisconception: concept?.misconceptions?.[0] || `Many assume this requires heavy overhead, but the streamlined contract eliminates redundant rounds.`,
          keyTakeaways: [
            `Core purpose: ${concept?.definition || 'Coordinates vital guarantees.'}`,
            `Analogy reminder: The airport tower coordinates before action is taken.`,
            `Prerequisites to remember: ${prerequisiteNames.join(', ') || 'Foundational architecture principles'}.`,
          ],
        }
      } else if (approach === 'STEP_BY_STEP') {
        reteachContent = {
          approach: 'STEP_BY_STEP',
          headline: `Deconstructing ${step.conceptName} Step-by-Step`,
          breakdownSteps: concept?.stepByStepExplanation?.length ? concept.stepByStepExplanation : [
            `Step 1: The system initiates the process and establishes baseline parameters.`,
            `Step 2: Dependencies and prerequisites are validated against current state.`,
            `Step 3: The core algorithm transforms inputs into verified outcomes.`,
            `Step 4: The outcome is committed with deterministic safety.`,
          ],
          deepDive: concept?.detailedExplanation || `Step-by-step breakdown removes cognitive load by inspecting each phase sequentially.`,
          commonMisconception: concept?.misconceptions?.[0] || `Skipping validation leads directly to state corruption.`,
          keyTakeaways: [
            `Notice how step 2 builds upon step 1.`,
            `Each step verifies intermediate correctness before proceeding.`,
          ],
        }
      } else {
        // VISUAL / CONCRETE
        reteachContent = {
          approach: 'VISUAL_CONCRETE',
          headline: `Concrete Case Study & Blueprint for ${step.conceptName}`,
          concreteCase: `Consider a scenario with 10,000 concurrent transactions: Without ${step.conceptName}, race conditions multiply exponentially. With it, throughput stabilizes.`,
          diagramDescription: `[Input Flow] ➔ [Validation Filter] ➔ [${step.conceptName} Engine] ➔ [Verified State]`,
          practicalExercise: `Mentally trace an input packet through each boundary to see where ambiguity is eliminated.`,
          keyTakeaways: [
            `Concrete inputs produce predictable deterministic outputs.`,
            `Observe the boundary verification points carefully.`,
          ],
        }
      }

      // Generate mini-test questions specifically targeting this weak concept
      const miniTestQuestions = [
        {
          id: `mini-1-${step.id}`,
          questionText: `Under the ${approach} perspective of ${step.conceptName}, what is the fundamental guarantee provided?`,
          options: [
            `It systematically prevents ambiguity and preserves core operational invariants.`,
            `It completely removes the need for underlying system validation.`,
            `It merely serves as optional decorative documentation.`,
            `It produces random non-deterministic outputs.`,
          ],
          correctAnswer: `It systematically prevents ambiguity and preserves core operational invariants.`,
          explanation: `As explained in the ${approach} breakdown, the primary purpose is preserving core invariants.`,
        },
        {
          id: `mini-2-${step.id}`,
          questionText: `Which common misconception regarding ${step.conceptName} was highlighted?`,
          options: [
            reteachContent.commonMisconception || `Assuming it operates in isolation without dependencies.`,
            `Believing that systems should never employ structured principles.`,
            `Assuming that all computational complexity can be solved without memory.`,
            `Assuming that computers execute instructions in reverse order.`,
          ],
          correctAnswer: reteachContent.commonMisconception || `Assuming it operates in isolation without dependencies.`,
          explanation: `The highlighted misconception clarifies why learners previously struggled on diagnostic tests.`,
        },
      ]

      reteachContent.miniTest = miniTestQuestions

      const updated = await prisma.recoveryStep.update({
        where: { id: stepId },
        data: {
          status: 'RETEACHED',
          approachUsed: approach,
          reteachContent,
        },
      })

      return updated
    },

    /**
     * Submit mini-test answers for a recovery step
     */
    submitMiniTest: async (userId, recoveryId, stepId, answers) => {
      const step = await prisma.recoveryStep.findFirst({
        where: { id: stepId, recoverySessionId: recoveryId },
        include: { recoverySession: { include: { steps: true } } },
      })
      if (!step || step.recoverySession.userId !== userId) {
        throw new HttpError(404, 'Recovery step not found.')
      }

      const miniTest = step.reteachContent?.miniTest || []
      let correct = 0
      for (const q of miniTest) {
        const userAns = (answers[q.id] || '').trim()
        if (userAns.toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
          correct++
        }
      }

      const score = miniTest.length > 0 ? (correct / miniTest.length) * 100 : 100
      const isPassed = score >= 50

      // Update concept mastery in DB
      const concept = await prisma.concept.findFirst({
        where: { userId, name: step.conceptName },
      })

      if (concept) {
        await prisma.conceptMastery.upsert({
          where: { conceptId: concept.id },
          create: {
            userId,
            conceptId: concept.id,
            status: isPassed ? 'IMPROVING' : 'WEAK',
            masteryScore: isPassed ? 75 : 35,
            totalAttempts: 1,
            correctAttempts: isPassed ? 1 : 0,
            lastReteachedAt: new Date(),
          },
          update: {
            status: isPassed ? 'IMPROVING' : 'WEAK',
            masteryScore: isPassed ? { increment: 25 } : { decrement: 5 },
            lastReteachedAt: new Date(),
          },
        })
      }

      const updatedStep = await prisma.recoveryStep.update({
        where: { id: stepId },
        data: {
          status: isPassed ? 'MASTERED' : 'PENDING',
          miniTestScore: score,
        },
      })

      // Check if all steps in recovery session are resolved
      const allSteps = await prisma.recoveryStep.findMany({
        where: { recoverySessionId: recoveryId },
      })
      const resolvedCount = allSteps.filter((s) => s.status === 'MASTERED').length
      const overallProgress = Math.round((resolvedCount / allSteps.length) * 100)
      const allCompleted = resolvedCount === allSteps.length

      await prisma.recoverySession.update({
        where: { id: recoveryId },
        data: {
          overallProgress,
          status: allCompleted ? 'COMPLETED' : 'IN_PROGRESS',
        },
      })

      return {
        step: updatedStep,
        score,
        isPassed,
        overallProgress,
        allCompleted,
        nextRecommendedAction: isPassed
          ? 'Concept successfully reinforced! Proceed to next weak area or explore knowledge map.'
          : 'Further refinement recommended. Alternate teaching strategy will be activated.',
      }
    },
  }
}
