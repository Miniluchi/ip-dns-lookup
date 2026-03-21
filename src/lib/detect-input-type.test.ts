import { describe, test, expect } from 'vitest'
import {
  detectInputType,
  isPrivateIp,
  sanitizeInput,
  buildIPv4PtrName,
  buildIPv6PtrName,
} from '@/lib/detect-input-type'

describe('sanitizeInput', () => {
  test('strips https:// prefix and path', () => {
    expect(sanitizeInput('https://example.com/path')).toBe('example.com')
  })
  test('strips http:// prefix and query string', () => {
    expect(sanitizeInput('http://example.com/path?q=1')).toBe('example.com')
  })
  test('trims surrounding whitespace', () => {
    expect(sanitizeInput('  example.com  ')).toBe('example.com')
  })
  test('lowercases input', () => {
    expect(sanitizeInput('EXAMPLE.COM')).toBe('example.com')
  })
})

describe('detectInputType', () => {
  test('detects valid IPv4: 192.168.1.1', () => {
    expect(detectInputType('192.168.1.1')).toBe('ipv4')
  })
  test('detects valid IPv4: 8.8.8.8', () => {
    expect(detectInputType('8.8.8.8')).toBe('ipv4')
  })
  test('detects valid IPv4: 255.255.255.255', () => {
    expect(detectInputType('255.255.255.255')).toBe('ipv4')
  })
  test('returns unknown for invalid IPv4 octets: 999.999.999.999', () => {
    expect(detectInputType('999.999.999.999')).toBe('unknown')
  })
  test('detects IPv6: 2001:4860:4860::8888', () => {
    expect(detectInputType('2001:4860:4860::8888')).toBe('ipv6')
  })
  test('detects IPv6 loopback: ::1', () => {
    expect(detectInputType('::1')).toBe('ipv6')
  })
  test('detects IPv6 link-local: fe80::1', () => {
    expect(detectInputType('fe80::1')).toBe('ipv6')
  })
  test('detects domain: example.com', () => {
    expect(detectInputType('example.com')).toBe('domain')
  })
  test('detects subdomain: sub.example.co.uk', () => {
    expect(detectInputType('sub.example.co.uk')).toBe('domain')
  })
  test('returns unknown for empty string', () => {
    expect(detectInputType('')).toBe('unknown')
  })
  test('returns unknown for invalid input: not valid!!', () => {
    expect(detectInputType('not valid!!')).toBe('unknown')
  })
  test('sanitizes URL and returns domain: https://example.com/path', () => {
    expect(detectInputType('https://example.com/path')).toBe('domain')
  })
  test('sanitizes URL and returns ipv4: http://8.8.8.8/path', () => {
    expect(detectInputType('http://8.8.8.8/path')).toBe('ipv4')
  })
})

describe('isPrivateIp', () => {
  test('10.0.0.1 is private (RFC 1918)', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true)
  })
  test('10.255.255.255 is private (RFC 1918 upper bound)', () => {
    expect(isPrivateIp('10.255.255.255')).toBe(true)
  })
  test('172.16.0.1 is private (RFC 1918)', () => {
    expect(isPrivateIp('172.16.0.1')).toBe(true)
  })
  test('172.31.255.255 is private (RFC 1918 upper bound)', () => {
    expect(isPrivateIp('172.31.255.255')).toBe(true)
  })
  test('172.32.0.0 is public (outside RFC 1918)', () => {
    expect(isPrivateIp('172.32.0.0')).toBe(false)
  })
  test('192.168.0.1 is private (RFC 1918)', () => {
    expect(isPrivateIp('192.168.0.1')).toBe(true)
  })
  test('192.168.255.255 is private (RFC 1918 upper bound)', () => {
    expect(isPrivateIp('192.168.255.255')).toBe(true)
  })
  test('127.0.0.1 is private (loopback)', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true)
  })
  test('127.255.255.255 is private (loopback upper bound)', () => {
    expect(isPrivateIp('127.255.255.255')).toBe(true)
  })
  test('169.254.1.1 is private (link-local)', () => {
    expect(isPrivateIp('169.254.1.1')).toBe(true)
  })
  test('100.64.0.1 is private (CGNAT)', () => {
    expect(isPrivateIp('100.64.0.1')).toBe(true)
  })
  test('100.127.255.255 is private (CGNAT upper bound)', () => {
    expect(isPrivateIp('100.127.255.255')).toBe(true)
  })
  test('192.0.2.1 is private (documentation)', () => {
    expect(isPrivateIp('192.0.2.1')).toBe(true)
  })
  test('198.51.100.1 is private (documentation)', () => {
    expect(isPrivateIp('198.51.100.1')).toBe(true)
  })
  test('203.0.113.1 is private (documentation)', () => {
    expect(isPrivateIp('203.0.113.1')).toBe(true)
  })
  test('224.0.0.1 is private (multicast)', () => {
    expect(isPrivateIp('224.0.0.1')).toBe(true)
  })
  test('8.8.8.8 is public', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false)
  })
  test('1.1.1.1 is public', () => {
    expect(isPrivateIp('1.1.1.1')).toBe(false)
  })
  test('::1 is private (IPv6 loopback)', () => {
    expect(isPrivateIp('::1')).toBe(true)
  })
  test('fe80::1 is private (IPv6 link-local)', () => {
    expect(isPrivateIp('fe80::1')).toBe(true)
  })
  test('fc00::1 is private (IPv6 ULA)', () => {
    expect(isPrivateIp('fc00::1')).toBe(true)
  })
  test('fd12::1 is private (IPv6 ULA)', () => {
    expect(isPrivateIp('fd12::1')).toBe(true)
  })
  test('2001:4860:4860::8888 is public IPv6', () => {
    expect(isPrivateIp('2001:4860:4860::8888')).toBe(false)
  })
})

describe('buildIPv4PtrName', () => {
  test('8.8.8.8 -> 8.8.8.8.in-addr.arpa', () => {
    expect(buildIPv4PtrName('8.8.8.8')).toBe('8.8.8.8.in-addr.arpa')
  })
  test('192.168.1.1 -> 1.1.168.192.in-addr.arpa', () => {
    expect(buildIPv4PtrName('192.168.1.1')).toBe('1.1.168.192.in-addr.arpa')
  })
})

describe('buildIPv6PtrName', () => {
  test('::1 ends with .ip6.arpa and has correct structure', () => {
    const result = buildIPv6PtrName('::1')
    expect(result.endsWith('.ip6.arpa')).toBe(true)
    // 32 nibbles + 31 dots between them + 9 chars for '.ip6.arpa' = 63 + 9 = 72... let's check dots
    // Actually: 32 nibbles separated by 31 dots = 63 chars, then '.ip6.arpa' = 9 chars total = 72
    const withoutSuffix = result.replace('.ip6.arpa', '')
    expect(withoutSuffix.split('.').length).toBe(32)
  })
  test('2001:4860:4860::8888 returns correct ip6.arpa string', () => {
    expect(buildIPv6PtrName('2001:4860:4860::8888')).toBe(
      '8.8.8.8.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.6.8.4.0.6.8.4.1.0.0.2.ip6.arpa'
    )
  })
  test('fe80::1 starts with 1.0.0.0 and ends with .ip6.arpa', () => {
    const result = buildIPv6PtrName('fe80::1')
    expect(result.startsWith('1.0.0.0')).toBe(true)
    expect(result.endsWith('.ip6.arpa')).toBe(true)
  })
  test('2001:db8:: returns correct ip6.arpa string', () => {
    expect(buildIPv6PtrName('2001:db8::')).toBe(
      '0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa'
    )
  })
})
