// Persistent store — pakai Vercel KV (Redis) kalau tersedia,
// fallback ke in-memory untuk local dev
import { Chunk, embed } from './rag'

const KV_KEY_CHUNKS = 'docsiq:chunks'
const KV_KEY_VECTORS = 'docsiq:vectors'

// Cek apakah Vercel KV tersedia
function hasKV(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

async function getKV() {
  const { kv } = await import('@vercel/kv')
  return kv
}

// ── In-memory fallback (local dev) ──────────────────────────
const globalStore = global as typeof global & {
  _dm_chunks?: Chunk[]
  _dm_vectors?: number[][]
}
if (!globalStore._dm_chunks) globalStore._dm_chunks = []
if (!globalStore._dm_vectors) globalStore._dm_vectors = []

// ── Public API ───────────────────────────────────────────────

export async function loadChunks(): Promise<{ chunks: Chunk[]; vectors: number[][] }> {
  if (hasKV()) {
    const kv = await getKV()
    const chunks = (await kv.get<Chunk[]>(KV_KEY_CHUNKS)) ?? []
    const vectors = (await kv.get<number[][]>(KV_KEY_VECTORS)) ?? []
    return { chunks, vectors }
  }
  return { chunks: globalStore._dm_chunks!, vectors: globalStore._dm_vectors! }
}

export async function saveChunks(chunks: Chunk[], vectors: number[][]): Promise<void> {
  if (hasKV()) {
    const kv = await getKV()
    // Simpan dengan TTL 7 hari
    await kv.set(KV_KEY_CHUNKS, chunks, { ex: 60 * 60 * 24 * 7 })
    await kv.set(KV_KEY_VECTORS, vectors, { ex: 60 * 60 * 24 * 7 })
    return
  }
  globalStore._dm_chunks = chunks
  globalStore._dm_vectors = vectors
}

export async function addChunksPersist(newChunks: Chunk[]): Promise<void> {
  const { chunks, vectors } = await loadChunks()

  for (const chunk of newChunks) {
    const existIdx = chunks.findIndex(c => c.id === chunk.id)
    if (existIdx >= 0) {
      chunks[existIdx] = chunk
      vectors[existIdx] = embed(chunk.text)
    } else {
      chunks.push(chunk)
      vectors.push(embed(chunk.text))
    }
  }

  await saveChunks(chunks, vectors)
}

export async function retrievePersist(query: string, k = 4): Promise<Chunk[]> {
  const { chunks, vectors } = await loadChunks()
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
  const { chunks } = await loadChunks()
  return {
    totalChunks: chunks.length,
    sources: [...new Set(chunks.map(c => c.source))],
  }
}
