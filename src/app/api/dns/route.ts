import type { NextRequest } from 'next/server'
import { isPrivateIp } from '@/lib/detect-input-type'

const RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'] as const

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')

  if (!q) {
    return Response.json(
      { error: { code: 'INVALID_INPUT', message: 'q parameter is required' } },
      { status: 422 }
    )
  }

  if (isPrivateIp(q)) {
    return Response.json(
      {
        error: {
          code: 'PRIVATE_IP',
          message: 'This is a private/reserved IP address — no external data available.',
        },
      },
      { status: 422 }
    )
  }

  try {
    const results = await Promise.allSettled(
      RECORD_TYPES.map(async (type) => {
        const res = await fetch(
          `https://dns.google/resolve?name=${encodeURIComponent(q)}&type=${type}`,
          { cache: 'no-store' }
        )
        if (!res.ok) throw new Error(`DNS ${type} fetch failed: ${res.status}`)
        const data = await res.json()
        return { type, answers: data.Answer ?? [] }
      })
    )

    const records: Record<string, Array<{ name: string; data: string; TTL: number }>> = {}

    for (const [i, result] of results.entries()) {
      const type = RECORD_TYPES[i]
      if (result.status === 'fulfilled') {
        records[type] = result.value.answers.map((a: { name: string; data: string; TTL: number }) => ({
          name: a.name,
          data: a.data,
          TTL: a.TTL,
        }))
      } else {
        records[type] = []
      }
    }

    return Response.json({ records })
  } catch {
    return Response.json(
      { error: { code: 'UPSTREAM_ERROR', message: 'Failed to reach DNS API' } },
      { status: 502 }
    )
  }
}
