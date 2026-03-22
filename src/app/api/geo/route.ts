import type { NextRequest } from 'next/server'
import { isPrivateIp } from '@/lib/detect-input-type'

const FIELDS = 'status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')

  const apiUrl = q
    ? `http://ip-api.com/json/${encodeURIComponent(q)}?fields=${FIELDS}`
    : `http://ip-api.com/json/?fields=${FIELDS}`

  if (q && isPrivateIp(q)) {
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
    const res = await fetch(apiUrl, { cache: 'no-store' })

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
