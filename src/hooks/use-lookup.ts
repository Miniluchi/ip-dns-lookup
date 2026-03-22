'use client'

import { useState, useCallback } from 'react'
import { sanitizeInput, detectInputType } from '@/lib/detect-input-type'

// ─── Type Exports ────────────────────────────────────────────────────────────

export type CardState<T> = {
  status: 'idle' | 'loading' | 'success' | 'error'
  data: T | null
  error: string | null
}

export type InputType = 'ipv4' | 'ipv6' | 'domain' | 'unknown'

export type GeoData = {
  status: string
  country: string
  countryCode: string
  region: string
  regionName: string
  city: string
  zip: string
  lat: number
  lon: number
  timezone: string
  isp: string
  org: string
  as: string
  query: string
}

export type DnsRecord = { name: string; data: string; TTL: number }
export type DnsData = {
  records: {
    A: DnsRecord[]
    AAAA: DnsRecord[]
    MX: DnsRecord[]
    TXT: DnsRecord[]
    NS: DnsRecord[]
    CNAME: DnsRecord[]
  }
}

export type RdnsData = { ptr: string[] }

export type WhoisData = {
  name: string
  registrar: string | null
  creationDate: string | null
  expirationDate: string | null
  lastChanged: string | null
  status: string[]
  nameservers: string[]
  raw: unknown
}

export type LookupState = {
  geo: CardState<GeoData>
  dns: CardState<DnsData>
  rdns: CardState<RdnsData>
  whois: CardState<WhoisData>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function idleCard<T>(): CardState<T> {
  return { status: 'idle', data: null, error: null }
}

function loadingCard<T>(): CardState<T> {
  return { status: 'loading', data: null, error: null }
}

async function fetchCard<T>(url: string): Promise<CardState<T>> {
  const res = await fetch(url)
  const json = await res.json()

  if (!res.ok || json.error) {
    const message: string =
      json?.error?.message ?? `Request failed with status ${res.status}`
    return { status: 'error', data: null, error: message }
  }

  return { status: 'success', data: json as T, error: null }
}

// ─── Pure orchestration logic (exported for unit tests) ──────────────────────

export type PerformLookupResult =
  | { valid: false }
  | { valid: true; state: LookupState; inputType: InputType }

export async function performLookup(raw: string): Promise<PerformLookupResult> {
  const sanitized = sanitizeInput(raw)
  const type = detectInputType(sanitized)

  if (!sanitized || type === 'unknown') {
    return { valid: false }
  }

  const isIp = type === 'ipv4' || type === 'ipv6'

  // Fire parallel API calls. rdns stays idle for domain input.
  const [geoResult, dnsResult, rdnsResult, whoisResult] =
    await Promise.allSettled([
      fetchCard<GeoData>(`/api/geo?q=${encodeURIComponent(sanitized)}`),
      fetchCard<DnsData>(`/api/dns?q=${encodeURIComponent(sanitized)}`),
      isIp
        ? fetchCard<RdnsData>(`/api/rdns?q=${encodeURIComponent(sanitized)}`)
        : Promise.resolve(idleCard<RdnsData>()),
      fetchCard<WhoisData>(`/api/whois?q=${encodeURIComponent(sanitized)}`),
    ])

  function settle<T>(result: PromiseSettledResult<CardState<T>>): CardState<T> {
    if (result.status === 'fulfilled') return result.value
    return { status: 'error', data: null, error: 'Request failed' }
  }

  const state: LookupState = {
    geo: settle(geoResult),
    dns: settle(dnsResult),
    rdns: settle(rdnsResult),
    whois: settle(whoisResult),
  }

  return { valid: true, state, inputType: type }
}

// ─── React Hook ──────────────────────────────────────────────────────────────

const initialState: LookupState = {
  geo: idleCard<GeoData>(),
  dns: idleCard<DnsData>(),
  rdns: idleCard<RdnsData>(),
  whois: idleCard<WhoisData>(),
}

export function useLookup() {
  const [state, setState] = useState<LookupState>(initialState)
  const [inputType, setInputType] = useState<InputType>('unknown')
  const [isLoading, setIsLoading] = useState(false)

  const lookup = useCallback(async (raw: string) => {
    const sanitized = sanitizeInput(raw)
    const type = detectInputType(sanitized)

    if (!sanitized || type === 'unknown') {
      return { valid: false }
    }

    const isIp = type === 'ipv4' || type === 'ipv6'

    // Set loading state immediately
    setState({
      geo: loadingCard<GeoData>(),
      dns: loadingCard<DnsData>(),
      rdns: isIp ? loadingCard<RdnsData>() : idleCard<RdnsData>(),
      whois: loadingCard<WhoisData>(),
    })
    setInputType(type)
    setIsLoading(true)

    try {
      const result = await performLookup(raw)
      if (result.valid) {
        setState(result.state)
      }
      return { valid: true }
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { state, inputType, isLoading, lookup }
}
