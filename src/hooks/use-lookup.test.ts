import { vi, beforeEach, describe, it, expect } from 'vitest'
import { performLookup } from './use-lookup'
import type { CardState, GeoData, DnsData, RdnsData, WhoisData } from './use-lookup'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
})

// Helper: make a successful JSON fetch response
function makeOkResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response)
}

// Helper: make a non-ok fetch response (e.g. 422 with error body)
function makeErrorResponse(status: number, data: unknown) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(data),
  } as Response)
}

describe('performLookup', () => {
  it('Test 1: returns { valid: false } for empty string and does not call fetch', async () => {
    const result = await performLookup('')
    expect(result).toEqual({ valid: false })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('Test 2: returns { valid: false } for invalid input', async () => {
    const result = await performLookup('not-valid!!!')
    expect(result).toEqual({ valid: false })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('Test 3: lookup of IP calls fetch for /api/geo, /api/dns, /api/rdns, /api/whois (4 calls)', async () => {
    const geoData: GeoData = {
      status: 'success', country: 'US', countryCode: 'US', region: 'CA',
      regionName: 'California', city: 'Mountain View', zip: '94043',
      lat: 37.386, lon: -122.0838, timezone: 'America/Los_Angeles',
      isp: 'Google LLC', org: 'Google LLC', as: 'AS15169', query: '8.8.8.8',
    }
    const dnsData: DnsData = { records: { A: [], AAAA: [], MX: [], TXT: [], NS: [], CNAME: [] } }
    const rdnsData: RdnsData = { ptr: ['dns.google'] }
    const whoisData: WhoisData = {
      name: '8.8.8.0/24', registrar: null, creationDate: null,
      expirationDate: null, lastChanged: null, status: [], nameservers: [], raw: {},
    }

    mockFetch
      .mockImplementationOnce(() => makeOkResponse(geoData))
      .mockImplementationOnce(() => makeOkResponse(dnsData))
      .mockImplementationOnce(() => makeOkResponse(rdnsData))
      .mockImplementationOnce(() => makeOkResponse(whoisData))

    const result = await performLookup('8.8.8.8')

    expect(result.valid).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(4)

    const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(urls.some((u) => u.includes('/api/geo'))).toBe(true)
    expect(urls.some((u) => u.includes('/api/dns'))).toBe(true)
    expect(urls.some((u) => u.includes('/api/rdns'))).toBe(true)
    expect(urls.some((u) => u.includes('/api/whois'))).toBe(true)
  })

  it('Test 4: lookup of domain calls geo, dns, whois but NOT rdns', async () => {
    const geoData: GeoData = {
      status: 'success', country: 'US', countryCode: 'US', region: 'CA',
      regionName: 'California', city: 'Palo Alto', zip: '94301',
      lat: 37.4, lon: -122.1, timezone: 'America/Los_Angeles',
      isp: 'Acme Inc', org: 'Acme Inc', as: 'AS12345', query: 'example.com',
    }
    const dnsData: DnsData = { records: { A: [], AAAA: [], MX: [], TXT: [], NS: [], CNAME: [] } }
    const whoisData: WhoisData = {
      name: 'EXAMPLE.COM', registrar: 'IANA', creationDate: '1995-08-14T04:00:00Z',
      expirationDate: '2026-08-13T04:00:00Z', lastChanged: null,
      status: ['clientDeleteProhibited'], nameservers: ['ns1.example.com'], raw: {},
    }

    mockFetch
      .mockImplementationOnce(() => makeOkResponse(geoData))
      .mockImplementationOnce(() => makeOkResponse(dnsData))
      .mockImplementationOnce(() => makeOkResponse(whoisData))

    const result = await performLookup('example.com')

    expect(result.valid).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(3)

    const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(urls.some((u) => u.includes('/api/rdns'))).toBe(false)

    if (result.valid) {
      expect(result.state.rdns.status).toBe('idle')
    }
  })

  it('Test 5: one fetch rejection leaves that card as error, others succeed', async () => {
    const dnsData: DnsData = { records: { A: [], AAAA: [], MX: [], TXT: [], NS: [], CNAME: [] } }
    const rdnsData: RdnsData = { ptr: [] }
    const whoisData: WhoisData = {
      name: '8.8.8.0/24', registrar: null, creationDate: null,
      expirationDate: null, lastChanged: null, status: [], nameservers: [], raw: {},
    }

    // geo rejects (network error), others succeed
    mockFetch
      .mockImplementationOnce(() => Promise.reject(new Error('Network error')))
      .mockImplementationOnce(() => makeOkResponse(dnsData))
      .mockImplementationOnce(() => makeOkResponse(rdnsData))
      .mockImplementationOnce(() => makeOkResponse(whoisData))

    const result = await performLookup('8.8.8.8')

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.state.geo.status).toBe('error')
      expect(result.state.dns.status).toBe('success')
      expect(result.state.rdns.status).toBe('success')
      expect(result.state.whois.status).toBe('success')
    }
  })

  it('Test 6: API error response (non-ok status) sets card to error with message', async () => {
    const dnsData: DnsData = { records: { A: [], AAAA: [], MX: [], TXT: [], NS: [], CNAME: [] } }
    const rdnsData: RdnsData = { ptr: [] }
    const whoisData: WhoisData = {
      name: '10.0.0.0/8', registrar: null, creationDate: null,
      expirationDate: null, lastChanged: null, status: [], nameservers: [], raw: {},
    }

    // geo returns 422 with error body
    mockFetch
      .mockImplementationOnce(() => makeErrorResponse(422, { error: { code: 'PRIVATE_IP', message: 'Private IP' } }))
      .mockImplementationOnce(() => makeOkResponse(dnsData))
      .mockImplementationOnce(() => makeOkResponse(rdnsData))
      .mockImplementationOnce(() => makeOkResponse(whoisData))

    const result = await performLookup('8.8.8.8')

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.state.geo.status).toBe('error')
      expect(result.state.geo.error).toBe('Private IP')
      expect(result.state.dns.status).toBe('success')
    }
  })
})
