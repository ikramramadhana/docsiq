import { NextRequest, NextResponse } from 'next/server'
import { deleteSourcePersist, clearAllPersist } from '@/lib/store'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { action, source } = await req.json()

    if (action === 'delete' && source) {
      await deleteSourcePersist(source)
      return NextResponse.json({ ok: true, message: `Dokumen "${source}" dihapus.` })
    }

    if (action === 'clear') {
      await clearAllPersist()
      return NextResponse.json({ ok: true, message: 'Semua dokumen dihapus.' })
    }

    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
