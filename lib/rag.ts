// DocsIQ RAG Engine
// Embedding: TF-IDF keyword vectors (no external model needed)
// Vector store: in-memory (global singleton, survives warm lambdas)

export interface Chunk {
  id: string
  text: string
  source: string
  index: number
  score?: number
}

// Global singleton — persists across requests on same Lambda instance
// On Vercel, this works well for moderate traffic (warm functions)
const globalStore = global as typeof global & {
  _docsiq_chunks?: Chunk[]
  _docsiq_vectors?: number[][]
}

if (!globalStore._docsiq_chunks) globalStore._docsiq_chunks = []
if (!globalStore._docsiq_vectors) globalStore._docsiq_vectors = []

const store = globalStore._docsiq_chunks
const vectors = globalStore._docsiq_vectors

// --- Text processing ---

export function chunkText(text: string, source: string, chunkSize = 600, overlap = 80): Chunk[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: Chunk[] = []
  let current = ''
  let idx = 0

  for (const sentence of sentences) {
    if ((current + sentence).length > chunkSize && current.length > 0) {
      chunks.push({ id: `${source}-${idx}`, text: current.trim(), source, index: idx++ })
      const words = current.split(' ')
      current = words.slice(-Math.floor(overlap / 5)).join(' ') + ' ' + sentence
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }
  if (current.trim()) chunks.push({ id: `${source}-${idx}`, text: current.trim(), source, index: idx })
  return chunks
}

// --- Embedding ---

const VOCAB_SIZE = 512
const STOPWORDS = new Set(['the','and','for','are','was','were','this','that','with','from','have','has','had','not','but','its','can','will','been','they','their','there','what','when','which','who','how','all','one','two','more','also','into','than','then','some','would','could','should','about','after','before','other','these','those','being','each','just','over','such','same','like','very','only','both','much','many','most','any','our','your','his','her','him'])

function hashCode(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i)
  return Math.abs(h)
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
}

export function embed(text: string): number[] {
  const tokens = tokenize(text).filter(t => !STOPWORDS.has(t))
  const vec = new Array(VOCAB_SIZE).fill(0)
  for (const token of tokens) vec[hashCode(token) % VOCAB_SIZE] += 1
  for (let i = 0; i < tokens.length - 1; i++) {
    vec[hashCode(tokens[i] + '_' + tokens[i + 1]) % VOCAB_SIZE] += 1.5
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map(v => v / norm)
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

// --- Store operations ---

export function addChunks(chunks: Chunk[]) {
  for (const chunk of chunks) {
    const existIdx = store.findIndex(c => c.id === chunk.id)
    if (existIdx >= 0) {
      store[existIdx] = chunk
      vectors[existIdx] = embed(chunk.text)
    } else {
      store.push(chunk)
      vectors.push(embed(chunk.text))
    }
  }
}

export function retrieve(query: string, k = 4): Chunk[] {
  if (store.length === 0) return []
  const qVec = embed(query)
  return store
    .map((chunk, i) => ({ ...chunk, score: cosineSim(qVec, vectors[i]) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, k)
    .filter(c => (c.score ?? 0) > 0.05)
}

export function getStats() {
  return {
    totalChunks: store.length,
    sources: [...new Set(store.map(c => c.source))],
  }
}

export function clearStore() {
  store.length = 0
  vectors.length = 0
}
