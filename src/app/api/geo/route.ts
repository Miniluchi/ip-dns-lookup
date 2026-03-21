import type { NextRequest } from 'next/server'
import { isPrivateIp } from '@/lib/detect-input-type'

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
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(q)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`,
      { cache: 'no-store' }
    )

    if (!res.ok) {
      return Response.json(
        { error: { code: 'UPSTREAM_ERROR', message: 'Geo lookup failed', upstreamStatus: res.status } },
        { status: 502 }
      )
    }

    const data = await res.json()

    if (data.status === 'fail') {
      return Response.json(
        { error: { code: 'UPSTREAM_ERROR', message: data.message ?? 'Geo lookup failed' } },
        { status: 502 }
      )
    }

    return Response.json(data)
  } catch {
    return Response.json(
      { error: { code: 'UPSTREAM_ERROR', message: 'Failed to reach geo API' } },
      { status: 502 }
    )
  }
}
