// Persistent store — Firebase Firestore kalau tersedia,
// fallback ke in-memory untuk local dev
import { Chunk, embed } from './rag'

const COLLECTION = 'docsiq_chunks'

function hasFirebase(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  )
}

// ── In-memory fallback (local dev tanpa Firebase) ────────────
const globalStore = global as typeof global & {
  _docsiq_chunks?: Chunk[]
  _docsiq_vectors?: number[][]
}
if (!globalStore._docsiq_chunks) globalStore._docsiq_chunks = []
if (!globalStore._docsiq_vectors) globalStore._docsiq_vectors = []

// ── Firebase operations ──────────────────────────────────────

async function fbAddChunks(newChunks: Chunk[]): Promise<void> {
  const { getDb } = await import('./firebase')
  const db = getDb()
  const batch = db.batch()

  for (const chunk of newChunks) {
    const ref = db.collection(COLLECTION).doc(chunk.id.replace(/[^a-zA-Z0-9_-]/g, '_'))
    batch.set(ref, {
      ...chunk,
      vector: embed(chunk.text),
      updatedAt: Date.now(),
    })
  }

  await batch.commit()
}

async function fbRetrieve(query: string, k = 4): Promise<Chunk[]> {
  const { getDb } = await import('./firebase')
  const db = getDb()

  const snapshot = await db.collection(COLLECTION).get()
  if (snapshot.empty) return []

  const qVec = embed(query)

  function cosineSim(a: number[], b: number[]): number {
    let dot = 0
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
    return dot
  }

  const scored = snapshot.docs.map(doc => {
    const data = doc.data()
    const vec: number[] = data.vector ?? []
    return {
      id: data.id,
      text: data.text,
      source: data.source,
      index: data.index,
      score: cosineSim(qVec, vec),
    } as Chunk
  })

  return scored
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, k)
    .filter(c => (c.score ?? 0) > 0.05)
}

async function fbGetStats() {
  const { getDb } = await import('./firebase')
  const db = getDb()

  const snapshot = await db.collection(COLLECTION).get()
  const sources = [...new Set(snapshot.docs.map(d => d.data().source as string))]
  return { totalChunks: snapshot.size, sources }
}

// ── Public API ───────────────────────────────────────────────

export async function addChunksPersist(newChunks: Chunk[]): Promise<void> {
  if (hasFirebase()) {
    await fbAddChunks(newChunks)
    return
  }
  // In-memory fallback
  for (const chunk of newChunks) {
    const existIdx = globalStore._docsiq_chunks!.findIndex(c => c.id === chunk.id)
    if (existIdx >= 0) {
      globalStore._docsiq_chunks![existIdx] = chunk
      globalStore._docsiq_vectors![existIdx] = embed(chunk.text)
    } else {
      globalStore._docsiq_chunks!.push(chunk)
      globalStore._docsiq_vectors!.push(embed(chunk.text))
    }
  }
}

export async function retrievePersist(query: string, k = 4): Promise<Chunk[]> {
  if (hasFirebase()) return fbRetrieve(query, k)

  // In-memory fallback
  const chunks = globalStore._docsiq_chunks!
  const vectors = globalStore._docsiq_vectors!
  if (chunks.length === 0) return []

  const qVec = embed(query)
  function cosineSim(a: number[], b: number[]): number {
    let dot = 0
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
    return dot
  }

  return chunks
    .map((chunk, i) => ({ ...chunk, score: cosineSim(qVec, vectors[i] ?? []) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, k)
    .filter(c => (c.score ?? 0) > 0.05)
}

export async function getStatsPersist() {
  if (hasFirebase()) return fbGetStats()

  const chunks = globalStore._docsiq_chunks!
  return {
    totalChunks: chunks.length,
    sources: [...new Set(chunks.map(c => c.source))],
  }
}
