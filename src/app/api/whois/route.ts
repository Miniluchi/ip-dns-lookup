import type { NextRequest } from 'next/server'
import { detectInputType, isPrivateIp } from '@/lib/detect-input-type'

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

  let rdapUrl: string
  if (inputType === 'domain') {
    rdapUrl = `https://rdap.org/domain/${encodeURIComponent(q)}`
  } else if (inputType === 'ipv4' || inputType === 'ipv6') {
    rdapUrl = `https://rdap.org/ip/${encodeURIComponent(q)}`
  } else {
    return Response.json(
      { error: { code: 'INVALID_INPUT', message: 'Input must be a valid domain or IP address.' } },
      { status: 422 }
    )
  }

  try {
    const res = await fetch(rdapUrl, { cache: 'no-store' })

    if (res.status === 404) {
      return Response.json(
        { error: { code: 'RDAP_NOT_SUPPORTED', message: 'WHOIS not available via RDAP for this TLD.' } },
        { status: 404 }
      )
    }

    if (!res.ok) {
      return Response.json(
        { error: { code: 'UPSTREAM_ERROR', message: 'WHOIS lookup failed', upstreamStatus: res.status } },
        { status: 502 }
      )
    }

    const rdap = await res.json()

    const response = {
      name: rdap.name ?? rdap.handle ?? q,
      registrar:
        rdap.entities
          ?.find((e: { roles?: string[] }) => e.roles?.includes('registrar'))
          ?.vcardArray?.[1]?.find((v: [string, ...unknown[]]) => v[0] === 'fn')?.[3] ?? null,
      creationDate:
        rdap.events?.find((e: { eventAction: string }) => e.eventAction === 'registration')?.eventDate ?? null,
      expirationDate:
        rdap.events?.find((e: { eventAction: string }) => e.eventAction === 'expiration')?.eventDate ?? null,
      lastChanged:
        rdap.events?.find((e: { eventAction: string }) => e.eventAction === 'last changed')?.eventDate ?? null,
      status: rdap.status ?? [],
      nameservers: rdap.nameservers?.map((ns: { ldhName?: string }) => ns.ldhName) ?? [],
      raw: rdap,
    }

    return Response.json(response)
  } catch {
    return Response.json(
      { error: { code: 'UPSTREAM_ERROR', message: 'Failed to reach WHOIS API' } },
      { status: 502 }
    )
  }
}
