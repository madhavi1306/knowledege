import { randomUUID } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_STORAGE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../storage/knowflow_db.json',
)

export class FileStoreError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = 'FileStoreError'
    this.cause = cause
  }
}

/**
 * File-persisted storage repository matching the Prisma API surface.
 * Guarantees zero-dependency standalone operation when external PostgreSQL is not running.
 */
export class FileStoreRepository {
  constructor(filePath = process.env.STORAGE_FILE || DEFAULT_STORAGE_PATH) {
    this.filePath = path.resolve(filePath)
    this.data = {
      users: [],
      documents: [],
      analyses: [],
      extractedPages: [],
      topics: [],
      concepts: [],
      topicConcepts: [],
      conceptSources: [],
      conceptRelationships: [],
      conceptMasteries: [],
      quizSessions: [],
      quizQuestions: [],
      recoverySessions: [],
      recoverySteps: [],
      spacedReviews: [],
      topicLearningMaterials: [],
      documentVisuals: [],
      documentChatSessions: [],
      documentChatMessages: [],
      weakTopicRecords: [],
      topicRevisionSessions: [],
      learningActivityEvents: [],
    }
    this.loaded = false
  }

  async init() {
    if (this.loaded) return
    try {
      await mkdir(path.dirname(this.filePath), { recursive: true })
    } catch (error) {
      throw new FileStoreError('Persistent storage is unavailable. Check the backend storage folder permissions.', error)
    }

    let raw
    try {
      raw = await readFile(this.filePath, 'utf-8')
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new FileStoreError('Persistent storage could not be read. Existing data was not changed.', error)
      }
      await this.save()
      this.loaded = true
      return
    }

    let savedData
    try {
      savedData = JSON.parse(raw)
    } catch (error) {
      throw new FileStoreError('Persistent storage contains invalid data. Existing data was not overwritten.', error)
    }
    if (!savedData || typeof savedData !== 'object' || Array.isArray(savedData)) {
      throw new FileStoreError('Persistent storage has an invalid format. Existing data was not overwritten.')
    }
    for (const key of Object.keys(this.data)) {
      if (savedData[key] !== undefined && !Array.isArray(savedData[key])) {
        throw new FileStoreError('Persistent storage has an invalid format. Existing data was not overwritten.')
      }
    }
    this.data = { ...this.data, ...savedData }
    this.loaded = true
  }

  async save() {
    try {
      await mkdir(path.dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (e) {
      throw new FileStoreError('Persistent storage could not save your changes. Check the backend storage folder permissions.', e)
    }
  }

  get user() {
    return {
      create: async ({ data }) => {
        await this.init()
        if (this.data.users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
          const err = new Error('Unique constraint violation')
          err.code = 'P2002'
          throw err
        }
        const now = new Date()
        const user = { id: randomUUID(), ...data, createdAt: now, updatedAt: now }
        this.data.users.push(user)
        await this.save()
        return user
      },
      findUnique: async ({ where }) => {
        await this.init()
        if (where.id) return this.data.users.find((u) => u.id === where.id) || null
        if (where.email) return this.data.users.find((u) => u.email.toLowerCase() === where.email.toLowerCase()) || null
        return null
      },
      update: async ({ where, data }) => {
        await this.init()
        const idx = this.data.users.findIndex((u) => u.id === where.id)
        if (idx === -1) throw new Error('User not found')
        this.data.users[idx] = { ...this.data.users[idx], ...data, updatedAt: new Date() }
        await this.save()
        return this.data.users[idx]
      },
    }
  }

  get document() {
    return {
      create: async ({ data }) => {
        await this.init()
        const now = new Date()
        const doc = { id: randomUUID(), ...data, uploadedAt: now, updatedAt: now }
        this.data.documents.push(doc)
        await this.save()
        return doc
      },
      findUnique: async ({ where }) => {
        await this.init()
        if (where.id) return this.data.documents.find((d) => d.id === where.id) || null
        if (where.userId_contentHash) {
          return this.data.documents.find(
            (d) => d.userId === where.userId_contentHash.userId && d.contentHash === where.userId_contentHash.contentHash
          ) || null
        }
        return null
      },
      findFirst: async ({ where }) => {
        await this.init()
        return this.data.documents.find((d) => (
          (!where.id || d.id === where.id) &&
          (!where.userId || d.userId === where.userId)
        )) || null
      },
      findMany: async ({ where, orderBy, cursor, take }) => {
        await this.init()
        let list = this.data.documents.filter((d) => {
          if (where?.userId && d.userId !== where.userId) return false
          if (where?.uploadStatus && d.uploadStatus !== where.uploadStatus) return false
          if (where?.OR && Array.isArray(where.OR)) {
            const matches = where.OR.some((clause) => {
              if (clause.fileName?.contains) {
                return d.fileName.toLowerCase().includes(clause.fileName.contains.toLowerCase())
              }
              if (clause.originalFileName?.contains) {
                return (d.originalFileName || '').toLowerCase().includes(clause.originalFileName.contains.toLowerCase())
              }
              return false
            })
            if (!matches) return false
          }
          return true
        })

        list = [...list].sort((a, b) => new Date(b.uploadedAt || b.createdAt) - new Date(a.uploadedAt || a.createdAt))
        if (cursor?.id) {
          const idx = list.findIndex((d) => d.id === cursor.id)
          if (idx !== -1) list = list.slice(idx + 1)
        }
        if (take) list = list.slice(0, take)
        return list
      },
      count: async ({ where }) => {
        await this.init()
        return this.data.documents.filter((d) => {
          if (where?.userId && d.userId !== where.userId) return false
          if (where?.uploadStatus && d.uploadStatus !== where.uploadStatus) return false
          if (where?.OR && Array.isArray(where.OR)) {
            const matches = where.OR.some((clause) => {
              if (clause.fileName?.contains) {
                return d.fileName.toLowerCase().includes(clause.fileName.contains.toLowerCase())
              }
              if (clause.originalFileName?.contains) {
                return (d.originalFileName || '').toLowerCase().includes(clause.originalFileName.contains.toLowerCase())
              }
              return false
            })
            if (!matches) return false
          }
          return true
        }).length
      },
      delete: async ({ where }) => {
        await this.init()
        const idx = this.data.documents.findIndex((d) => d.id === where.id)
        if (idx !== -1) {
          const removed = this.data.documents.splice(idx, 1)[0]
          await this.save()
          return removed
        }
        return null
      },
      update: async ({ where, data }) => {
        await this.init()
        const idx = this.data.documents.findIndex((d) => d.id === where.id)
        if (idx !== -1) {
          this.data.documents[idx] = { ...this.data.documents[idx], ...data, updatedAt: new Date() }
          await this.save()
          return this.data.documents[idx]
        }
        return null
      },
    }
  }

  get documentAnalysis() {
    return {
      create: async ({ data }) => {
        await this.init()
        const now = new Date()
        const item = { id: randomUUID(), ...data, createdAt: now, updatedAt: now }
        this.data.analyses.push(item)
        await this.save()
        return item
      },
      upsert: async ({ where, create, update }) => {
        await this.init()
        const idx = this.data.analyses.findIndex((a) => a.documentId === where.documentId || a.id === where.id)
        if (idx !== -1) {
          this.data.analyses[idx] = { ...this.data.analyses[idx], ...update, updatedAt: new Date() }
          await this.save()
          return this.data.analyses[idx]
        }
        const now = new Date()
        const item = { id: randomUUID(), ...create, createdAt: now, updatedAt: now }
        this.data.analyses.push(item)
        await this.save()
        return item
      },
      findUnique: async ({ where }) => {
        await this.init()
        return this.data.analyses.find((a) => a.documentId === where.documentId || a.id === where.id) || null
      },
      findFirst: async ({ where }) => {
        await this.init()
        return this.data.analyses.find((a) => a.userId === where.userId && (a.documentId === where.documentId || a.id === where.id)) || null
      },
      update: async ({ where, data }) => {
        await this.init()
        const idx = this.data.analyses.findIndex((a) => a.id === where.id || a.documentId === where.documentId)
        if (idx !== -1) {
          this.data.analyses[idx] = { ...this.data.analyses[idx], ...data, updatedAt: new Date() }
          await this.save()
          return this.data.analyses[idx]
        }
        return null
      },
      updateMany: async ({ where, data }) => {
        await this.init()
        let count = 0
        for (let i = 0; i < this.data.analyses.length; i++) {
          const item = this.data.analyses[i]
          const matchesStatus = !where?.status || item.status === where.status || (where.status.in && where.status.in.includes(item.status))
          if (matchesStatus) {
            this.data.analyses[i] = { ...this.data.analyses[i], ...data, updatedAt: new Date() }
            count++
          }
        }
        await this.save()
        return { count }
      },
      deleteMany: async ({ where }) => {
        await this.init()
        let count = 0
        if (where?.documentId) {
          const lenBefore = this.data.analyses.length
          this.data.analyses = this.data.analyses.filter((a) => a.documentId !== where.documentId)
          count = lenBefore - this.data.analyses.length
        }
        await this.save()
        return { count }
      },
      findMany: async ({ where, select, orderBy, take }) => {
        await this.init()
        let list = this.data.analyses
        if (where?.status) {
          list = list.filter((a) => a.status === where.status)
        }
        if (where?.userId) {
          list = list.filter((a) => a.userId === where.userId)
        }
        if (orderBy?.createdAt === 'asc') {
          list = [...list].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        }
        if (take) {
          list = list.slice(0, take)
        }
        return list
      },
    }
  }

  get concept() {
    return {
      create: async ({ data }) => {
        await this.init()
        const now = new Date()
        const item = { id: randomUUID(), ...data, createdAt: now, updatedAt: now }
        this.data.concepts.push(item)
        await this.save()
        return item
      },
      findMany: async ({ where, take }) => {
        await this.init()
        let list = this.data.concepts.filter((c) => !where?.userId || c.userId === where.userId)
        if (where?.id?.in) {
          list = list.filter((c) => where.id.in.includes(c.id))
        }
        if (where?.topics?.some?.topicId) {
          const reqTopicId = where.topics.some.topicId
          const targetTopic = this.data.topics.find((t) => t.id === reqTopicId)
          const relevantTopics = [
            targetTopic,
            ...this.data.topics.filter((t) => t.parentId === reqTopicId),
          ].filter(Boolean)

          const childTopicIds = new Set(relevantTopics.map((t) => t.id))
          const matchingConceptIds = new Set(
            this.data.topicConcepts
              .filter((tc) => childTopicIds.has(tc.topicId))
              .map((tc) => tc.conceptId)
          )

          for (const relTopic of relevantTopics) {
            const tName = relTopic.name.toLowerCase().trim()
            const tKey = tName.replace(/^chapter\s*\d+:\s*/i, '').trim()
            for (const c of this.data.concepts) {
              const cName = c.name.toLowerCase().trim()
              if (
                cName === tName ||
                cName.includes(tName) ||
                tName.includes(cName) ||
                (tKey && (cName.includes(tKey) || tKey.includes(cName)))
              ) {
                matchingConceptIds.add(c.id)
              }
            }
          }

          list = list.filter((c) => matchingConceptIds.has(c.id))
        }
        if (where?.OR && Array.isArray(where.OR)) {
          list = list.filter((c) =>
            where.OR.some((cond) => {
              if (cond.name?.contains) {
                return c.name.toLowerCase().includes(cond.name.contains.toLowerCase())
              }
              if (cond.definition?.contains) {
                return c.definition.toLowerCase().includes(cond.definition.contains.toLowerCase())
              }
              return false
            })
          )
        }
        const enriched = list.map((c) => ({
          ...c,
          mastery: this.data.conceptMasteries.find((m) => m.conceptId === c.id) || null,
          spacedReview: this.data.spacedReviews.find((s) => s.conceptId === c.id) || null,
          topics: this.data.topicConcepts.filter((tc) => tc.conceptId === c.id).map((tc) => ({
            topic: this.data.topics.find((t) => t.id === tc.topicId) || { id: tc.topicId, name: 'General' },
          })),
          sources: this.data.conceptSources.filter((cs) => cs.conceptId === c.id),
          outgoingRelationships: this.data.conceptRelationships.filter((r) => r.fromConceptId === c.id).map((r) => ({
            ...r,
            toConcept: this.data.concepts.find((target) => target.id === r.toConceptId) || { id: r.toConceptId, name: 'Target' },
          })),
          incomingRelationships: this.data.conceptRelationships.filter((r) => r.toConceptId === c.id).map((r) => ({
            ...r,
            fromConcept: this.data.concepts.find((target) => target.id === r.fromConceptId) || { id: r.fromConceptId, name: 'Source' },
          })),
        }))
        return take ? enriched.slice(0, take) : enriched
      },
      findFirst: async ({ where }) => {
        await this.init()
        const found = this.data.concepts.find((c) => (
          (!where.userId || c.userId === where.userId) &&
          (!where.id || c.id === where.id) &&
          (!where.name || c.name === where.name) &&
          (!where.normalizedName || c.normalizedName === where.normalizedName)
        ))
        if (!found) return null
        return {
          ...found,
          mastery: this.data.conceptMasteries.find((m) => m.conceptId === found.id) || null,
          spacedReview: this.data.spacedReviews.find((s) => s.conceptId === found.id) || null,
          topics: this.data.topicConcepts.filter((tc) => tc.conceptId === found.id).map((tc) => ({
            topic: this.data.topics.find((t) => t.id === tc.topicId) || { id: tc.topicId, name: 'General' },
          })),
          sources: this.data.conceptSources.filter((cs) => cs.conceptId === found.id),
          outgoingRelationships: this.data.conceptRelationships.filter((r) => r.fromConceptId === found.id).map((r) => ({
            ...r,
            toConcept: this.data.concepts.find((target) => target.id === r.toConceptId) || { id: r.toConceptId, name: 'Target' },
          })),
          incomingRelationships: this.data.conceptRelationships.filter((r) => r.toConceptId === found.id).map((r) => ({
            ...r,
            fromConcept: this.data.concepts.find((target) => target.id === r.fromConceptId) || { id: r.fromConceptId, name: 'Source' },
          })),
        }
      },
      findUnique: async ({ where }) => {
        await this.init()
        if (where.userId_normalizedName) {
          return this.data.concepts.find(
            (c) => c.userId === where.userId_normalizedName.userId && c.normalizedName === where.userId_normalizedName.normalizedName
          ) || null
        }
        return this.data.concepts.find((c) => c.id === where.id) || null
      },
      update: async ({ where, data }) => {
        await this.init()
        const idx = this.data.concepts.findIndex((c) => c.id === where.id)
        if (idx !== -1) {
          this.data.concepts[idx] = { ...this.data.concepts[idx], ...data, updatedAt: new Date() }
          await this.save()
          return this.data.concepts[idx]
        }
        return null
      },
      deleteMany: async ({ where }) => {
        await this.init()
        let count = 0
        if (where?.userId && where?.sources?.none) {
          const referencedConceptIds = new Set(this.data.conceptSources.map((cs) => cs.conceptId))
          const lenBefore = this.data.concepts.length
          this.data.concepts = this.data.concepts.filter(
            (c) => c.userId !== where.userId || referencedConceptIds.has(c.id)
          )
          count = lenBefore - this.data.concepts.length
        }
        await this.save()
        return { count }
      },
    }
  }

  get extractedPage() {
    return {
      createMany: async ({ data }) => {
        await this.init()
        for (const item of data) {
          this.data.extractedPages.push({ id: randomUUID(), ...item, createdAt: new Date() })
        }
        await this.save()
        return { count: data.length }
      },
      deleteMany: async ({ where }) => {
        await this.init()
        let count = 0
        if (where?.documentAnalysisId) {
          const lenBefore = this.data.extractedPages.length
          this.data.extractedPages = this.data.extractedPages.filter((p) => p.documentAnalysisId !== where.documentAnalysisId)
          count = lenBefore - this.data.extractedPages.length
        }
        await this.save()
        return { count }
      },
      findMany: async ({ where, orderBy }) => {
        await this.init()
        let list = this.data.extractedPages
        if (where?.documentAnalysisId) {
          list = list.filter((p) => p.documentAnalysisId === where.documentAnalysisId)
        }
        if (where?.documentId) {
          list = list.filter((p) => p.documentId === where.documentId)
        }
        if (orderBy?.pageNumber === 'asc') {
          list = [...list].sort((a, b) => a.pageNumber - b.pageNumber)
        }
        return list
      },
    }
  }

  get topic() {
    return {
      create: async ({ data }) => {
        await this.init()
        const item = { id: randomUUID(), ...data, createdAt: new Date() }
        this.data.topics.push(item)
        await this.save()
        return item
      },
      findUnique: async ({ where }) => {
        await this.init()
        const topic = this.data.topics.find((t) => t.id === where.id)
        if (!topic) return null
        return {
          ...topic,
          learningMaterial: (this.data.topicLearningMaterials || []).find((m) => m.topicId === topic.id) || null,
        }
      },
      findFirst: async ({ where }) => {
        await this.init()
        const topic = this.data.topics.find((t) => (
          (!where.id || t.id === where.id) &&
          (!where.documentAnalysisId || t.documentAnalysisId === where.documentAnalysisId) &&
          (!where.name || t.name === where.name)
        ))
        if (!topic) return null
        return {
          ...topic,
          learningMaterial: (this.data.topicLearningMaterials || []).find((m) => m.topicId === topic.id) || null,
        }
      },
      update: async ({ where, data }) => {
        await this.init()
        const idx = this.data.topics.findIndex((t) => t.id === where.id)
        if (idx !== -1) {
          this.data.topics[idx] = { ...this.data.topics[idx], ...data }
          await this.save()
          return this.data.topics[idx]
        }
        return null
      },
      deleteMany: async ({ where }) => {
        await this.init()
        let count = 0
        if (where?.documentAnalysisId) {
          const lenBefore = this.data.topics.length
          this.data.topics = this.data.topics.filter((t) => t.documentAnalysisId !== where.documentAnalysisId)
          count = lenBefore - this.data.topics.length
        }
        await this.save()
        return { count }
      },
      findMany: async ({ where, orderBy, include }) => {
        await this.init()
        let list = this.data.topics
        if (where?.documentAnalysisId) {
          list = list.filter((t) => t.documentAnalysisId === where.documentAnalysisId)
        }
        return list.map((t) => ({
          ...t,
          learningMaterial: (this.data.topicLearningMaterials || []).find((m) => m.topicId === t.id) || null,
        }))
      },
    }
  }

  get topicLearningMaterial() {
    return {
      create: async ({ data }) => {
        await this.init()
        this.data.topicLearningMaterials ||= []
        const item = {
          id: randomUUID(),
          ...data,
          lastGeneratedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        this.data.topicLearningMaterials.push(item)
        await this.save()
        return item
      },
      upsert: async ({ where, create, update }) => {
        await this.init()
        this.data.topicLearningMaterials ||= []
        const idx = this.data.topicLearningMaterials.findIndex((m) => m.topicId === where.topicId || m.id === where.id)
        if (idx !== -1) {
          this.data.topicLearningMaterials[idx] = {
            ...this.data.topicLearningMaterials[idx],
            ...update,
            updatedAt: new Date(),
          }
          await this.save()
          return this.data.topicLearningMaterials[idx]
        }
        const item = {
          id: randomUUID(),
          ...create,
          lastGeneratedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        this.data.topicLearningMaterials.push(item)
        await this.save()
        return item
      },
      findUnique: async ({ where, include }) => {
        await this.init()
        this.data.topicLearningMaterials ||= []
        const item = this.data.topicLearningMaterials.find((m) => m.topicId === where.topicId || m.id === where.id) || null
        if (!item) return null
        if (include?.topic) {
          item.topic = this.data.topics.find((t) => t.id === item.topicId) || null
        }
        return item
      },
      findFirst: async ({ where, include }) => {
        await this.init()
        this.data.topicLearningMaterials ||= []
        const item = this.data.topicLearningMaterials.find((m) => (
          (!where.topicId || m.topicId === where.topicId) &&
          (!where.documentId || m.documentId === where.documentId) &&
          (!where.userId || m.userId === where.userId) &&
          (!where.id || m.id === where.id)
        )) || null
        if (!item) return null
        if (include?.topic) {
          item.topic = this.data.topics.find((t) => t.id === item.topicId) || null
        }
        return item
      },
      findMany: async ({ where, orderBy, include }) => {
        await this.init()
        this.data.topicLearningMaterials ||= []
        let list = this.data.topicLearningMaterials.filter((m) => (
          (!where?.documentId || m.documentId === where.documentId) &&
          (!where?.userId || m.userId === where.userId) &&
          (!where?.documentAnalysisId || m.documentAnalysisId === where.documentAnalysisId) &&
          (!where?.status || m.status === where.status)
        ))
        if (orderBy?.orderIndex === 'asc') {
          list = [...list].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        }
        if (include?.topic) {
          list = list.map((m) => ({
            ...m,
            topic: this.data.topics.find((t) => t.id === m.topicId) || null,
          }))
        }
        return list
      },
      update: async ({ where, data }) => {
        await this.init()
        this.data.topicLearningMaterials ||= []
        const idx = this.data.topicLearningMaterials.findIndex((m) => m.topicId === where.topicId || m.id === where.id)
        if (idx !== -1) {
          this.data.topicLearningMaterials[idx] = {
            ...this.data.topicLearningMaterials[idx],
            ...data,
            updatedAt: new Date(),
          }
          await this.save()
          return this.data.topicLearningMaterials[idx]
        }
        return null
      },
      deleteMany: async ({ where }) => {
        await this.init()
        this.data.topicLearningMaterials ||= []
        let count = 0
        if (where?.documentId) {
          const lenBefore = this.data.topicLearningMaterials.length
          this.data.topicLearningMaterials = this.data.topicLearningMaterials.filter((m) => m.documentId !== where.documentId)
          count = lenBefore - this.data.topicLearningMaterials.length
        }
        await this.save()
        return { count }
      },
    }
  }

  get conceptSource() {
    return {
      deleteMany: async ({ where }) => {
        await this.init()
        let count = 0
        if (where?.documentAnalysisId) {
          const lenBefore = this.data.conceptSources.length
          this.data.conceptSources = this.data.conceptSources.filter((s) => s.documentAnalysisId !== where.documentAnalysisId)
          count = lenBefore - this.data.conceptSources.length
        }
        await this.save()
        return { count }
      },
      upsert: async ({ where, create, update }) => {
        await this.init()
        const criteria = where?.conceptId_documentAnalysisId_pageNumber
        const idx = this.data.conceptSources.findIndex(
          (cs) => cs.conceptId === criteria?.conceptId &&
                  cs.documentAnalysisId === criteria?.documentAnalysisId &&
                  cs.pageNumber === criteria?.pageNumber
        )
        if (idx !== -1) {
          this.data.conceptSources[idx] = { ...this.data.conceptSources[idx], ...update }
          await this.save()
          return this.data.conceptSources[idx]
        }
        const item = { id: randomUUID(), ...create, createdAt: new Date() }
        this.data.conceptSources.push(item)
        await this.save()
        return item
      },
      findMany: async ({ where }) => {
        await this.init()
        let list = this.data.conceptSources
        if (where?.documentAnalysisId) {
          list = list.filter((s) => s.documentAnalysisId === where.documentAnalysisId)
        }
        return list
      },
    }
  }

  get conceptRelationship() {
    return {
      deleteMany: async ({ where }) => {
        await this.init()
        let count = 0
        if (where?.documentAnalysisId) {
          const lenBefore = this.data.conceptRelationships.length
          this.data.conceptRelationships = this.data.conceptRelationships.filter((r) => r.documentAnalysisId !== where.documentAnalysisId)
          count = lenBefore - this.data.conceptRelationships.length
        }
        await this.save()
        return { count }
      },
      upsert: async ({ where, create, update }) => {
        await this.init()
        const criteria = where?.documentAnalysisId_fromConceptId_toConceptId_type
        const idx = this.data.conceptRelationships.findIndex(
          (r) => r.documentAnalysisId === criteria?.documentAnalysisId &&
                 r.fromConceptId === criteria?.fromConceptId &&
                 r.toConceptId === criteria?.toConceptId &&
                 r.type === criteria?.type
        )
        if (idx !== -1) {
          this.data.conceptRelationships[idx] = { ...this.data.conceptRelationships[idx], ...update }
          await this.save()
          return this.data.conceptRelationships[idx]
        }
        const item = { id: randomUUID(), ...create, createdAt: new Date() }
        this.data.conceptRelationships.push(item)
        await this.save()
        return item
      },
      updateMany: async ({ where, data }) => {
        await this.init()
        let count = 0
        for (let i = 0; i < this.data.conceptRelationships.length; i++) {
          if (!where?.status || where.status.in?.includes(this.data.conceptRelationships[i].status)) {
            this.data.conceptRelationships[i] = { ...this.data.conceptRelationships[i], ...data }
            count++
          }
        }
        await this.save()
        return { count }
      },
      findMany: async ({ where }) => {
        await this.init()
        let list = this.data.conceptRelationships
        if (where?.userId) list = list.filter((r) => r.userId === where.userId)
        if (where?.documentAnalysisId) list = list.filter((r) => r.documentAnalysisId === where.documentAnalysisId)
        return list
      },
      create: async ({ data }) => {
        await this.init()
        const item = { id: randomUUID(), ...data, createdAt: new Date() }
        this.data.conceptRelationships.push(item)
        await this.save()
        return item
      },
    }
  }

  get conceptMastery() {
    return {
      findUnique: async ({ where }) => {
        await this.init()
        return this.data.conceptMasteries.find((m) => m.conceptId === where.conceptId) || null
      },
      upsert: async ({ where, create, update }) => {
        await this.init()
        const idx = this.data.conceptMasteries.findIndex((m) => m.conceptId === where.conceptId)
        if (idx !== -1) {
          this.data.conceptMasteries[idx] = { ...this.data.conceptMasteries[idx], ...update, updatedAt: new Date() }
          await this.save()
          return this.data.conceptMasteries[idx]
        }
        const item = { id: randomUUID(), ...create, createdAt: new Date(), updatedAt: new Date() }
        this.data.conceptMasteries.push(item)
        await this.save()
        return item
      },
      create: async ({ data }) => {
        await this.init()
        const item = { id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }
        this.data.conceptMasteries.push(item)
        await this.save()
        return item
      },
      update: async ({ where, data }) => {
        await this.init()
        const idx = this.data.conceptMasteries.findIndex((m) => m.conceptId === where.conceptId)
        if (idx !== -1) {
          this.data.conceptMasteries[idx] = { ...this.data.conceptMasteries[idx], ...data, updatedAt: new Date() }
          await this.save()
          return this.data.conceptMasteries[idx]
        }
        return null
      },
    }
  }

  get quizSession() {
    return {
      create: async ({ data }) => {
        await this.init()
        const id = randomUUID()
        const questions = (data.questions?.create || []).map((q) => ({
          id: randomUUID(),
          ...q,
          quizSessionId: id,
          createdAt: new Date(),
        }))
        for (const q of questions) this.data.quizQuestions.push(q)
        const session = {
          id,
          ...data,
          questions,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        this.data.quizSessions.push(session)
        await this.save()
        return session
      },
      findUnique: async ({ where }) => {
        await this.init()
        const session = this.data.quizSessions.find((s) => s.id === where.id)
        if (!session) return null
        return {
          ...session,
          questions: this.data.quizQuestions.filter((q) => q.quizSessionId === session.id),
          recoverySession: this.data.recoverySessions?.find((r) => r.quizSessionId === session.id) || null,
        }
      },
      findFirst: async ({ where }) => {
        await this.init()
        const session = this.data.quizSessions.find((s) => {
          if (where.id && s.id !== where.id) return false
          if (where.userId && s.userId !== where.userId) return false
          if (where.documentId && s.documentId !== where.documentId) return false
          if (where.topicId && s.topicId !== where.topicId) return false
          if (where.completed !== undefined && s.completed !== where.completed) return false
          return true
        })
        if (!session) return null
        return {
          ...session,
          questions: this.data.quizQuestions.filter((q) => q.quizSessionId === session.id),
          recoverySession: this.data.recoverySessions?.find((r) => r.quizSessionId === session.id) || null,
        }
      },
      findMany: async ({ where, orderBy, take }) => {
        await this.init()
        let list = this.data.quizSessions.filter((s) => {
          if (where?.userId && s.userId !== where.userId) return false
          if (where?.documentId && s.documentId !== where.documentId) return false
          if (where?.topicId && s.topicId !== where.topicId) return false
          if (where?.completed !== undefined && s.completed !== where.completed) return false
          return true
        })
        if (orderBy?.createdAt === 'desc') list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        if (take) list = list.slice(0, take)
        return list.map((s) => ({
          ...s,
          questions: this.data.quizQuestions.filter((q) => q.quizSessionId === s.id),
          _count: { questions: this.data.quizQuestions.filter((q) => q.quizSessionId === s.id).length },
        }))
      },
      update: async ({ where, data }) => {
        await this.init()
        const idx = this.data.quizSessions.findIndex((s) => s.id === where.id)
        if (idx !== -1) {
          this.data.quizSessions[idx] = { ...this.data.quizSessions[idx], ...data, updatedAt: new Date() }
          await this.save()
          return {
            ...this.data.quizSessions[idx],
            questions: this.data.quizQuestions.filter((q) => q.quizSessionId === where.id),
          }
        }
        return null
      },
    }
  }

  get quizQuestion() {
    return {
      findMany: async ({ where } = {}) => {
        await this.init()
        return this.data.quizQuestions.filter((q) => !where?.quizSessionId || q.quizSessionId === where.quizSessionId)
      },
      findUnique: async ({ where }) => {
        await this.init()
        return this.data.quizQuestions.find((q) => q.id === where.id) || null
      },
      update: async ({ where, data }) => {
        await this.init()
        const idx = this.data.quizQuestions.findIndex((q) => q.id === where.id)
        if (idx !== -1) {
          this.data.quizQuestions[idx] = { ...this.data.quizQuestions[idx], ...data }
          await this.save()
          return this.data.quizQuestions[idx]
        }
        return null
      },
    }
  }

  get topicConcept() {
    return {
      upsert: async ({ where, create }) => {
        await this.init()
        this.data.topicConcepts ||= []
        const topicId = where.topicId_conceptId?.topicId || create?.topicId
        const conceptId = where.topicId_conceptId?.conceptId || create?.conceptId
        let tc = this.data.topicConcepts.find((t) => t.topicId === topicId && t.conceptId === conceptId)
        if (!tc) {
          tc = { topicId, conceptId }
          this.data.topicConcepts.push(tc)
          await this.save()
        }
        return tc
      },
      create: async ({ data }) => {
        await this.init()
        this.data.topicConcepts ||= []
        this.data.topicConcepts.push(data)
        await this.save()
        return data
      },
      findMany: async ({ where } = {}) => {
        await this.init()
        this.data.topicConcepts ||= []
        return this.data.topicConcepts.filter((tc) => {
          if (where?.topicId?.in && !where.topicId.in.includes(tc.topicId)) return false
          if (where?.topicId && typeof where.topicId === 'string' && tc.topicId !== where.topicId) return false
          if (where?.conceptId?.in && !where.conceptId.in.includes(tc.conceptId)) return false
          if (where?.conceptId && typeof where.conceptId === 'string' && tc.conceptId !== where.conceptId) return false
          return true
        })
      },
    }
  }

  get recoverySession() {
    return {
      create: async ({ data }) => {
        await this.init()
        const id = randomUUID()
        const steps = (data.steps?.create || []).map((s) => ({
          id: randomUUID(),
          ...s,
          recoverySessionId: id,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
        for (const st of steps) this.data.recoverySteps.push(st)
        const session = {
          id,
          ...data,
          steps,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        this.data.recoverySessions.push(session)
        await this.save()
        return session
      },
      findFirst: async ({ where }) => {
        await this.init()
        const session = this.data.recoverySessions.find((r) => r.id === where.id && (!where.userId || r.userId === where.userId))
        if (!session) return null
        return {
          ...session,
          steps: this.data.recoverySteps.filter((st) => st.recoverySessionId === session.id).sort((a, b) => a.stepOrder - b.stepOrder),
        }
      },
      updateMany: async ({ where, data }) => {
        await this.init()
        let count = 0
        for (let i = 0; i < this.data.analyses.length; i++) {
          if (!where?.status || where.status.in?.includes(this.data.analyses[i].status)) {
            this.data.analyses[i] = { ...this.data.analyses[i], ...data, updatedAt: new Date() }
            count++
          }
        }
        await this.save()
        return { count }
      },
      findMany: async ({ where }) => {
        await this.init()
        const list = this.data.recoverySessions.filter((r) => !where?.userId || r.userId === where.userId)
        return list.map((r) => ({
          ...r,
          steps: this.data.recoverySteps.filter((st) => st.recoverySessionId === r.id),
        }))
      },
      update: async ({ where, data }) => {
        await this.init()
        const idx = this.data.recoverySessions.findIndex((r) => r.id === where.id)
        if (idx !== -1) {
          this.data.recoverySessions[idx] = { ...this.data.recoverySessions[idx], ...data, updatedAt: new Date() }
          await this.save()
          return this.data.recoverySessions[idx]
        }
        return null
      },
    }
  }

  get recoveryStep() {
    return {
      findFirst: async ({ where }) => {
        await this.init()
        const step = this.data.recoverySteps.find((st) => st.id === where.id && (!where.recoverySessionId || st.recoverySessionId === where.recoverySessionId))
        if (!step) return null
        const session = this.data.recoverySessions.find((r) => r.id === step.recoverySessionId)
        return { ...step, recoverySession: session }
      },
      updateMany: async ({ where, data }) => {
        await this.init()
        let count = 0
        for (let i = 0; i < this.data.analyses.length; i++) {
          if (!where?.status || where.status.in?.includes(this.data.analyses[i].status)) {
            this.data.analyses[i] = { ...this.data.analyses[i], ...data, updatedAt: new Date() }
            count++
          }
        }
        await this.save()
        return { count }
      },
      findMany: async ({ where }) => {
        await this.init()
        return this.data.recoverySteps.filter((st) => st.recoverySessionId === where.recoverySessionId)
      },
      update: async ({ where, data }) => {
        await this.init()
        const idx = this.data.recoverySteps.findIndex((st) => st.id === where.id)
        if (idx !== -1) {
          this.data.recoverySteps[idx] = { ...this.data.recoverySteps[idx], ...data, updatedAt: new Date() }
          await this.save()
          return this.data.recoverySteps[idx]
        }
        return null
      },
    }
  }

  get spacedReview() {
    return {
      findUnique: async ({ where }) => {
        await this.init()
        return this.data.spacedReviews.find((s) => s.conceptId === where.conceptId) || null
      },
      upsert: async ({ where, create, update }) => {
        await this.init()
        const idx = this.data.spacedReviews.findIndex((s) => s.conceptId === where.conceptId)
        if (idx !== -1) {
          this.data.spacedReviews[idx] = { ...this.data.spacedReviews[idx], ...update, updatedAt: new Date() }
          await this.save()
          return this.data.spacedReviews[idx]
        }
        const item = { id: randomUUID(), ...create, createdAt: new Date(), updatedAt: new Date() }
        this.data.spacedReviews.push(item)
        await this.save()
        return item
      },
      create: async ({ data }) => {
        await this.init()
        const item = { id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }
        this.data.spacedReviews.push(item)
        await this.save()
        return item
      },
    }
  }

  get documentVisual() {
    return {
      create: async ({ data }) => {
        await this.init()
        this.data.documentVisuals ||= []
        const item = {
          id: randomUUID(),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        this.data.documentVisuals.push(item)
        await this.save()
        return item
      },
      upsert: async ({ where, create, update }) => {
        await this.init()
        this.data.documentVisuals ||= []
        const idx = this.data.documentVisuals.findIndex((v) => v.id === where.id)
        if (idx !== -1) {
          this.data.documentVisuals[idx] = {
            ...this.data.documentVisuals[idx],
            ...update,
            updatedAt: new Date(),
          }
          await this.save()
          return this.data.documentVisuals[idx]
        }
        const item = {
          id: where.id || randomUUID(),
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        this.data.documentVisuals.push(item)
        await this.save()
        return item
      },
      findUnique: async ({ where }) => {
        await this.init()
        this.data.documentVisuals ||= []
        return this.data.documentVisuals.find((v) => v.id === where.id) || null
      },
      findFirst: async ({ where }) => {
        await this.init()
        this.data.documentVisuals ||= []
        return this.data.documentVisuals.find((v) => (
          (!where.id || v.id === where.id) &&
          (!where.documentId || v.documentId === where.documentId) &&
          (!where.pageNumber || v.pageNumber === where.pageNumber)
        )) || null
      },
      findMany: async ({ where, orderBy }) => {
        await this.init()
        this.data.documentVisuals ||= []
        let list = this.data.documentVisuals.filter((v) => (
          (!where?.documentId || v.documentId === where.documentId) &&
          (!where?.pageNumber || v.pageNumber === where.pageNumber) &&
          (!where?.type || v.type === where.type)
        ))
        if (orderBy?.pageNumber === 'asc') {
          list = [...list].sort((a, b) => a.pageNumber - b.pageNumber || a.visualIndex - b.visualIndex)
        }
        return list
      },
      update: async ({ where, data }) => {
        await this.init()
        this.data.documentVisuals ||= []
        const idx = this.data.documentVisuals.findIndex((v) => v.id === where.id)
        if (idx !== -1) {
          this.data.documentVisuals[idx] = {
            ...this.data.documentVisuals[idx],
            ...data,
            updatedAt: new Date(),
          }
          await this.save()
          return this.data.documentVisuals[idx]
        }
        return null
      },
      deleteMany: async ({ where }) => {
        await this.init()
        this.data.documentVisuals ||= []
        let count = 0
        if (where?.documentId) {
          const lenBefore = this.data.documentVisuals.length
          this.data.documentVisuals = this.data.documentVisuals.filter((v) => v.documentId !== where.documentId)
          count = lenBefore - this.data.documentVisuals.length
        }
        await this.save()
        return { count }
      },
    }
  }

  get documentChatSession() {
    return {
      create: async ({ data }) => {
        await this.init()
        this.data.documentChatSessions ||= []
        const now = new Date()
        const session = {
          id: randomUUID(),
          title: data.title || 'Document Q&A Session',
          userId: data.userId,
          documentId: data.documentId,
          topicId: data.topicId || null,
          createdAt: now,
          updatedAt: now,
        }
        this.data.documentChatSessions.push(session)
        await this.save()
        return session
      },
      findUnique: async ({ where, include }) => {
        await this.init()
        this.data.documentChatSessions ||= []
        this.data.documentChatMessages ||= []
        const session = this.data.documentChatSessions.find((s) => s.id === where.id) || null
        if (!session) return null
        if (include?.messages) {
          const messages = this.data.documentChatMessages
            .filter((m) => m.sessionId === session.id)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          return { ...session, messages }
        }
        return session
      },
      findFirst: async ({ where, include }) => {
        await this.init()
        this.data.documentChatSessions ||= []
        this.data.documentChatMessages ||= []
        const session = this.data.documentChatSessions.find((s) => {
          if (where.id && s.id !== where.id) return false
          if (where.userId && s.userId !== where.userId) return false
          if (where.documentId && s.documentId !== where.documentId) return false
          if (where.topicId !== undefined && s.topicId !== where.topicId) return false
          return true
        }) || null
        if (!session) return null
        if (include?.messages) {
          const messages = this.data.documentChatMessages
            .filter((m) => m.sessionId === session.id)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          return { ...session, messages }
        }
        return session
      },
      findMany: async ({ where, include, orderBy }) => {
        await this.init()
        this.data.documentChatSessions ||= []
        this.data.documentChatMessages ||= []
        let list = this.data.documentChatSessions.filter((s) => {
          if (where?.userId && s.userId !== where.userId) return false
          if (where?.documentId && s.documentId !== where.documentId) return false
          if (where?.topicId && s.topicId !== where.topicId) return false
          return true
        })
        if (orderBy?.updatedAt === 'desc') {
          list = [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        }
        if (include?.messages) {
          list = list.map((session) => {
            const messages = this.data.documentChatMessages
              .filter((m) => m.sessionId === session.id)
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            return { ...session, messages }
          })
        }
        return list
      },
      update: async ({ where, data }) => {
        await this.init()
        this.data.documentChatSessions ||= []
        const idx = this.data.documentChatSessions.findIndex((s) => s.id === where.id)
        if (idx !== -1) {
          this.data.documentChatSessions[idx] = {
            ...this.data.documentChatSessions[idx],
            ...data,
            updatedAt: new Date(),
          }
          await this.save()
          return this.data.documentChatSessions[idx]
        }
        return null
      },
      delete: async ({ where }) => {
        await this.init()
        this.data.documentChatSessions ||= []
        this.data.documentChatMessages ||= []
        const idx = this.data.documentChatSessions.findIndex((s) => s.id === where.id)
        if (idx !== -1) {
          const [deleted] = this.data.documentChatSessions.splice(idx, 1)
          this.data.documentChatMessages = this.data.documentChatMessages.filter((m) => m.sessionId !== where.id)
          await this.save()
          return deleted
        }
        return null
      },
      deleteMany: async ({ where }) => {
        await this.init()
        this.data.documentChatSessions ||= []
        this.data.documentChatMessages ||= []
        let count = 0
        if (where?.documentId) {
          const matchingIds = new Set(this.data.documentChatSessions.filter((s) => s.documentId === where.documentId).map((s) => s.id))
          this.data.documentChatSessions = this.data.documentChatSessions.filter((s) => !matchingIds.has(s.id))
          this.data.documentChatMessages = this.data.documentChatMessages.filter((m) => !matchingIds.has(m.sessionId))
          count = matchingIds.size
        }
        await this.save()
        return { count }
      },
    }
  }

  get documentChatMessage() {
    return {
      create: async ({ data }) => {
        await this.init()
        this.data.documentChatMessages ||= []
        const now = new Date()
        const msg = {
          id: randomUUID(),
          sessionId: data.sessionId,
          role: data.role || 'user',
          content: data.content,
          directAnswer: data.directAnswer || null,
          simpleExplanation: data.simpleExplanation || null,
          example: data.example || null,
          importantPoints: data.importantPoints || [],
          pageReferences: data.pageReferences || [],
          retrievedChunks: data.retrievedChunks || [],
          citations: data.citations || [],
          supplementary: Boolean(data.supplementary),
          notCovered: Boolean(data.notCovered),
          createdAt: now,
        }
        this.data.documentChatMessages.push(msg)

        // update session's updatedAt timestamp
        const session = this.data.documentChatSessions?.find((s) => s.id === data.sessionId)
        if (session) {
          session.updatedAt = now
        }

        await this.save()
        return msg
      },
      findMany: async ({ where, orderBy }) => {
        await this.init()
        this.data.documentChatMessages ||= []
        let list = this.data.documentChatMessages.filter((m) => {
          if (where?.sessionId && m.sessionId !== where.sessionId) return false
          return true
        })
        if (orderBy?.createdAt === 'asc') {
          list = [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        }
        return list
      },
      deleteMany: async ({ where }) => {
        await this.init()
        this.data.documentChatMessages ||= []
        let count = 0
        if (where?.sessionId) {
          const lenBefore = this.data.documentChatMessages.length
          this.data.documentChatMessages = this.data.documentChatMessages.filter((m) => m.sessionId !== where.sessionId)
          count = lenBefore - this.data.documentChatMessages.length
        }
        await this.save()
        return { count }
      },
    }
  }

  get weakTopicRecord() {
    return {
      upsert: async ({ where, update, create }) => {
        await this.init()
        this.data.weakTopicRecords ||= []
        const uniqueKey = where.userId_documentId_topicName
        const idx = this.data.weakTopicRecords.findIndex((r) => {
          if (uniqueKey) {
            return (
              r.userId === uniqueKey.userId &&
              r.documentId === uniqueKey.documentId &&
              r.topicName.toLowerCase() === uniqueKey.topicName.toLowerCase()
            )
          }
          if (where.id) return r.id === where.id
          return false
        })

        const now = new Date()
        if (idx !== -1) {
          this.data.weakTopicRecords[idx] = {
            ...this.data.weakTopicRecords[idx],
            ...update,
            updatedAt: now,
          }
          await this.save()
          return this.data.weakTopicRecords[idx]
        } else {
          const newRecord = {
            id: randomUUID(),
            ...create,
            createdAt: now,
            updatedAt: now,
          }
          this.data.weakTopicRecords.push(newRecord)
          await this.save()
          return newRecord
        }
      },
      create: async ({ data }) => {
        await this.init()
        this.data.weakTopicRecords ||= []
        const now = new Date()
        const record = {
          id: randomUUID(),
          ...data,
          createdAt: now,
          updatedAt: now,
        }
        this.data.weakTopicRecords.push(record)
        await this.save()
        return record
      },
      findUnique: async ({ where }) => {
        await this.init()
        this.data.weakTopicRecords ||= []
        return this.data.weakTopicRecords.find((r) => r.id === where.id) || null
      },
      findFirst: async ({ where }) => {
        await this.init()
        this.data.weakTopicRecords ||= []
        return (
          this.data.weakTopicRecords.find((r) => {
            if (where.id && r.id !== where.id) return false
            if (where.userId && r.userId !== where.userId) return false
            if (where.documentId && r.documentId !== where.documentId) return false
            if (where.topicName && r.topicName.toLowerCase() !== where.topicName.toLowerCase()) return false
            if (where.status && r.status !== where.status) return false
            return true
          }) || null
        )
      },
      findMany: async ({ where, orderBy } = {}) => {
        await this.init()
        this.data.weakTopicRecords ||= []
        let list = this.data.weakTopicRecords.filter((r) => {
          if (where?.userId && r.userId !== where.userId) return false
          if (where?.documentId && r.documentId !== where.documentId) return false
          if (where?.status && r.status !== where.status) return false
          return true
        })
        if (orderBy?.updatedAt === 'desc') {
          list = [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        }
        return list
      },
      update: async ({ where, data }) => {
        await this.init()
        this.data.weakTopicRecords ||= []
        const idx = this.data.weakTopicRecords.findIndex((r) => r.id === where.id)
        if (idx !== -1) {
          this.data.weakTopicRecords[idx] = {
            ...this.data.weakTopicRecords[idx],
            ...data,
            updatedAt: new Date(),
          }
          await this.save()
          return this.data.weakTopicRecords[idx]
        }
        return null
      },
      delete: async ({ where }) => {
        await this.init()
        this.data.weakTopicRecords ||= []
        const idx = this.data.weakTopicRecords.findIndex((r) => r.id === where.id)
        if (idx !== -1) {
          const [deleted] = this.data.weakTopicRecords.splice(idx, 1)
          await this.save()
          return deleted
        }
        return null
      },
      deleteMany: async ({ where } = {}) => {
        await this.init()
        this.data.weakTopicRecords ||= []
        let count = 0
        if (where?.documentId) {
          const lenBefore = this.data.weakTopicRecords.length
          this.data.weakTopicRecords = this.data.weakTopicRecords.filter((r) => r.documentId !== where.documentId)
          count = lenBefore - this.data.weakTopicRecords.length
        }
        await this.save()
        return { count }
      },
    }
  }

  get topicRevisionSession() {
    return {
      create: async ({ data }) => {
        await this.init()
        this.data.topicRevisionSessions ||= []
        const now = new Date()
        const sess = {
          id: randomUUID(),
          ...data,
          createdAt: now,
          updatedAt: now,
        }
        this.data.topicRevisionSessions.push(sess)
        await this.save()
        return sess
      },
      findUnique: async ({ where }) => {
        await this.init()
        this.data.topicRevisionSessions ||= []
        return this.data.topicRevisionSessions.find((s) => s.id === where.id) || null
      },
      findFirst: async ({ where }) => {
        await this.init()
        this.data.topicRevisionSessions ||= []
        return (
          this.data.topicRevisionSessions.find((s) => {
            if (where.id && s.id !== where.id) return false
            if (where.weakTopicRecordId && s.weakTopicRecordId !== where.weakTopicRecordId) return false
            if (where.userId && s.userId !== where.userId) return false
            if (where.documentId && s.documentId !== where.documentId) return false
            return true
          }) || null
        )
      },
      findMany: async ({ where, orderBy } = {}) => {
        await this.init()
        this.data.topicRevisionSessions ||= []
        let list = this.data.topicRevisionSessions.filter((s) => {
          if (where?.weakTopicRecordId && s.weakTopicRecordId !== where.weakTopicRecordId) return false
          if (where?.userId && s.userId !== where.userId) return false
          if (where?.documentId && s.documentId !== where.documentId) return false
          return true
        })
        if (orderBy?.createdAt === 'desc') {
          list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        }
        return list
      },
      update: async ({ where, data }) => {
        await this.init()
        this.data.topicRevisionSessions ||= []
        const idx = this.data.topicRevisionSessions.findIndex((s) => s.id === where.id)
        if (idx !== -1) {
          this.data.topicRevisionSessions[idx] = {
            ...this.data.topicRevisionSessions[idx],
            ...data,
            updatedAt: new Date(),
          }
          await this.save()
          return this.data.topicRevisionSessions[idx]
        }
        return null
      },
    }
  }

  get learningActivityEvent() {
    return {
      create: async ({ data }) => {
        await this.init()
        this.data.learningActivityEvents ||= []
        const item = {
          id: randomUUID(),
          ...data,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        }
        this.data.learningActivityEvents.push(item)
        await this.save()
        return item
      },
      findMany: async ({ where, orderBy, take } = {}) => {
        await this.init()
        let items = (this.data.learningActivityEvents || []).filter((e) => {
          if (where?.userId && e.userId !== where.userId) return false
          if (where?.documentId && e.documentId !== where.documentId) return false
          if (where?.eventType && e.eventType !== where.eventType) return false
          return true
        })
        if (orderBy?.createdAt === 'desc') {
          items = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        } else if (orderBy?.createdAt === 'asc') {
          items = [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        }
        if (take) {
          items = items.slice(0, take)
        }
        return items
      },
      count: async ({ where } = {}) => {
        await this.init()
        return (this.data.learningActivityEvents || []).filter((e) => {
          if (where?.userId && e.userId !== where.userId) return false
          if (where?.documentId && e.documentId !== where.documentId) return false
          if (where?.eventType && e.eventType !== where.eventType) return false
          return true
        }).length
      },
      deleteMany: async ({ where } = {}) => {
        await this.init()
        this.data.learningActivityEvents ||= []
        const initial = this.data.learningActivityEvents.length
        this.data.learningActivityEvents = this.data.learningActivityEvents.filter((e) => {
          if (where?.userId && e.userId === where.userId) return false
          if (where?.documentId && e.documentId === where.documentId) return false
          return true
        })
        await this.save()
        return { count: initial - this.data.learningActivityEvents.length }
      },
    }
  }

  async $transaction(callback) {
    await this.init()
    return callback(this)
  }

  async $connect() {
    await this.init()
  }

  async $disconnect() {
    await this.save()
  }
}
