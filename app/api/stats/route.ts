import { NextResponse } from 'next/server'
import { getStatsPersist } from '@/lib/store'

export const runtime = 'nodejs'

export async function GET() {
  const stats = await getStatsPersist()
  return NextResponse.json(stats)
}
