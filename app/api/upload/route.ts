import { NextRequest, NextResponse } from 'next/server'
import { chunkText } from '@/lib/rag'
import { addChunksPersist, getStatsPersist } from '@/lib/store'

export const runtime = 'nodejs'
export const maxDuration = 30

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    try {
      const data = await pdfParse(buffer)
      if (!data?.text?.trim()) throw new Error('PDF tidak memiliki teks yang bisa diekstrak (mungkin hasil scan/gambar)')
      return data.text
    } catch (err) {
      throw new Error(`Gagal baca PDF: ${err instanceof Error ? err.message : err}`)
    }
  }

  return buffer.toString('utf-8')
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const results = []

    for (const file of files) {
      try {
        const text = await extractText(file)

        if (!text.trim()) {
          results.push({ name: file.name, status: 'error', message: 'Teks kosong setelah ekstraksi' })
          continue
        }

        const chunks = chunkText(text, file.name)
        await addChunksPersist(chunks)

        results.push({
          name: file.name,
          status: 'ok',
          chunks: chunks.length,
          chars: text.length,
        })
      } catch (fileErr) {
        results.push({
          name: file.name,
          status: 'error',
          message: fileErr instanceof Error ? fileErr.message : String(fileErr),
        })
      }
    }

    const stats = await getStatsPersist()
    return NextResponse.json({ results, stats })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
