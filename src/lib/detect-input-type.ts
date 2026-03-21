/**
 * sanitizeInput: trim whitespace, strip protocol prefix, strip path/query, lowercase.
 */
export function sanitizeInput(raw: string): string {
  let s = raw.trim()
  // Strip protocol (http:// or https://, case-insensitive)
  s = s.replace(/^https?:\/\//i, '')
  // Strip path (everything from first / onward)
  const slashIdx = s.indexOf('/')
  if (slashIdx !== -1) {
    s = s.substring(0, slashIdx)
  }
  // Strip query string (if somehow remained)
  const queryIdx = s.indexOf('?')
  if (queryIdx !== -1) {
    s = s.substring(0, queryIdx)
  }
  return s.toLowerCase()
}

/**
 * detectInputType: classify sanitized input as ipv4, ipv6, domain, or unknown.
 */
export function detectInputType(
  input: string
): 'ipv4' | 'ipv6' | 'domain' | 'unknown' {
  const s = sanitizeInput(input)

  if (!s) return 'unknown'

  // IPv4 check
  const ipv4Re = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  const ipv4Match = s.match(ipv4Re)
  if (ipv4Match) {
    const octets = [ipv4Match[1], ipv4Match[2], ipv4Match[3], ipv4Match[4]]
    if (octets.every((o) => parseInt(o, 10) >= 0 && parseInt(o, 10) <= 255)) {
      return 'ipv4'
    }
    return 'unknown'
  }

  // IPv6 check: must contain at least one colon
  if (s.includes(':')) {
    if (isValidIPv6(s)) return 'ipv6'
    return 'unknown'
  }

  // Domain check
  const domainRe = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/
  if (domainRe.test(s)) return 'domain'

  return 'unknown'
}

/**
 * isValidIPv6: basic validation — only hex digits, colons, at most one ::
 */
function isValidIPv6(s: string): boolean {
  // At most one ::
  if ((s.match(/::/g) || []).length > 1) return false
  // Characters: hex digits and colons only
  if (!/^[0-9a-f:]+$/i.test(s)) return false
  return true
}

/**
 * isPrivateIp: returns true if the IP is in a private/reserved range.
 * Uses manual arithmetic checks, no external library.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv6 checks
  if (ip.includes(':')) {
    const normalized = ip.toLowerCase()
    if (normalized === '::1') return true
    if (normalized.startsWith('fe80:')) return true
    if (normalized.startsWith('fc00:') || normalized.startsWith('fd')) return true
    return false
  }

  // IPv4 checks
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  const [a, b, c] = parts.map((p) => parseInt(p, 10))

  // 10.0.0.0/8
  if (a === 10) return true
  // 172.16.0.0/12 (172.16.x.x – 172.31.x.x)
  if (a === 172 && b >= 16 && b <= 31) return true
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true
  // 100.64.0.0/10 (CGNAT: 100.64–100.127)
  if (a === 100 && b >= 64 && b <= 127) return true
  // 192.0.2.0/24 (documentation TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true
  // 198.51.100.0/24 (documentation TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true
  // 203.0.113.0/24 (documentation TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true
  // 224.0.0.0/4 (multicast: 224–239)
  if (a >= 224 && a <= 239) return true

  return false
}

/**
 * buildIPv4PtrName: reverse octets, append .in-addr.arpa
 */
export function buildIPv4PtrName(ip: string): string {
  return ip.split('.').reverse().join('.') + '.in-addr.arpa'
}

/**
 * buildIPv6PtrName: expand :: notation to full 8 groups, remove colons,
 * split into 32 nibbles, reverse, join with dots, append .ip6.arpa
 */
export function buildIPv6PtrName(ip: string): string {
  const expanded = expandIPv6(ip)
  // Remove colons to get 32 hex chars
  const hex = expanded.replace(/:/g, '')
  // Split into individual nibbles, reverse, join with dots
  return hex.split('').reverse().join('.') + '.ip6.arpa'
}

/**
 * expandIPv6: expand an IPv6 address (possibly with ::) to full 8-group form.
 * Each group is zero-padded to 4 hex digits.
 */
function expandIPv6(ip: string): string {
  const halves = ip.split('::')

  if (halves.length === 2) {
    // Has :: — split left and right groups
    const left = halves[0] ? halves[0].split(':') : []
    const right = halves[1] ? halves[1].split(':') : []
    const missing = 8 - left.length - right.length
    const middle = Array(missing).fill('0000')
    const groups = [
      ...left.map((g) => g.padStart(4, '0')),
      ...middle,
      ...right.map((g) => g.padStart(4, '0')),
    ]
    return groups.join(':')
  } else {
    // No :: — already 8 groups, just pad each
    return ip.split(':').map((g) => g.padStart(4, '0')).join(':')
  }
}
