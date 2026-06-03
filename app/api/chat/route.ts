import { NextRequest, NextResponse } from 'next/server'
import { retrievePersist, getStatsPersist } from '@/lib/store'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 30

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || '',
  baseURL: 'https://api.groq.com/openai/v1',
})

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json()
    if (!message) return NextResponse.json({ error: 'No message' }, { status: 400 })

    const stats = await getStatsPersist()
    if (stats.totalChunks === 0) {
      return NextResponse.json({
        answer: 'Belum ada dokumen yang di-upload. Silakan upload dokumen terlebih dahulu.',
        chunks: [],
        noDoc: true,
      })
    }

    const chunks = await retrievePersist(message, 4)

    if (chunks.length === 0) {
      return NextResponse.json({
        answer: 'Saya tidak menemukan informasi relevan di dokumen yang di-upload untuk pertanyaan ini.',
        chunks: [],
      })
    }

    const context = chunks
      .map((c, i) => `[${i + 1}] (dari: ${c.source})\n${c.text}`)
      .join('\n\n---\n\n')

    const systemPrompt = `Kamu adalah asisten AI bernama DocsIQ yang menjawab pertanyaan HANYA berdasarkan dokumen yang diberikan pengguna.

ATURAN:
- Jawab HANYA dari konteks di bawah. Jangan tambahkan informasi dari luar dokumen.
- Jika jawabannya tidak ada, katakan: "Informasi ini tidak tersedia di dokumen yang di-upload."
- Jawab dalam bahasa yang sama dengan pertanyaan pengguna (Indonesia atau Inggris).
- Sertakan referensi [1], [2] dst. jika mengambil dari beberapa bagian.
- Jawab dengan jelas dan ringkas.

KONTEKS DOKUMEN:
${context}`

    const messages = [
      ...history.slice(-6).map((h: { role: string; content: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ]

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.3,
      max_tokens: 1024,
    })

    const answer = completion.choices[0].message.content || ''

    return NextResponse.json({
      answer,
      chunks: chunks.map(c => ({
        source: c.source,
        text: c.text.slice(0, 180) + '...',
        score: Math.round((c.score ?? 0) * 100),
      })),
    })
  } catch (err: unknown) {
    console.error('Chat error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('API key') || msg.includes('401')) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY tidak valid. Cek Environment Variables di Vercel dashboard.' },
        { status: 401 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
