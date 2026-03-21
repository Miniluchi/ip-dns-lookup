import type { NextRequest } from 'next/server'
import {
  detectInputType,
  isPrivateIp,
  buildIPv4PtrName,
  buildIPv6PtrName,
} from '@/lib/detect-input-type'

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

  const inputType = detectInputType(q)

  if (inputType === 'domain') {
    return Response.json(
      { error: { code: 'INVALID_INPUT', message: 'Reverse DNS requires an IP address, not a domain.' } },
      { status: 422 }
    )
  }

  let ptrName: string
  if (inputType === 'ipv4') {
    ptrName = buildIPv4PtrName(q)
  } else if (inputType === 'ipv6') {
    ptrName = buildIPv6PtrName(q)
  } else {
    return Response.json(
      { error: { code: 'INVALID_INPUT', message: 'Input must be a valid IP address.' } },
      { status: 422 }
    )
  }

  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(ptrName)}&type=PTR`,
      { cache: 'no-store' }
    )

    if (!res.ok) {
      return Response.json(
        { error: { code: 'UPSTREAM_ERROR', message: 'Reverse DNS lookup failed', upstreamStatus: res.status } },
        { status: 502 }
      )
    }

    const data = await res.json()
    const ptrs = (data.Answer ?? []).map((a: { data: string }) => a.data)

    return Response.json({ ptr: ptrs })
  } catch {
    return Response.json(
      { error: { code: 'UPSTREAM_ERROR', message: 'Failed to reach reverse DNS API' } },
      { status: 502 }
    )
  }
}
