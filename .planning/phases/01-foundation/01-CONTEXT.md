# Phase 1: Foundation - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the Next.js 15 project and build all 4 API route handlers (`/api/geo`, `/api/dns`, `/api/rdns`, `/api/whois`) with input detection utilities in place. No UI rendering — this phase is purely infrastructure and backend proxy layer. Phase 2 builds the client components that consume these routes.

</domain>

<decisions>
## Implementation Decisions

### Project Structure
- Use `src/` subdirectory: `src/app/`, `src/components/`, `src/hooks/`, `src/lib/`
- Bootstrap command: `create-next-app@latest --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- Import alias: `@/*` maps to `src/`
- shadcn/ui components: `src/components/ui/` (default shadcn path — do not override)
- shadcn style: New York, CSS variables enabled

### Tech Stack (locked)
- Next.js 15+ App Router
- TypeScript strict mode
- Tailwind CSS v4
- shadcn/ui (New York)
- next-themes (dark mode without FOUC)
- No external data-fetching library — native `fetch` + `Promise.allSettled`

### API Proxy Architecture (locked)
- All external API calls go through Next.js route handlers — mandatory because ip-api.com free tier is HTTP-only (mixed content blocked on HTTPS)
- Never call ip-api.com directly from the browser
- Route handlers are the only place that knows upstream API URLs
- `Promise.allSettled` used at both layers: in `useLookup` hook (Phase 2) and inside `/api/dns/route.ts` for parallel record types

### Normalized Error Shape (shared across all 4 handlers)
All 4 route handlers return the same error structure. Define a shared `ApiError` type:

```ts
// src/lib/api-error.ts
export type ApiError = {
  error: {
    code: string       // e.g. 'PRIVATE_IP', 'UPSTREAM_ERROR', 'NOT_FOUND', 'INVALID_INPUT'
    message: string    // Human-readable message for card display
    upstreamStatus?: number  // HTTP status from upstream API (when proxying a failure)
  }
}
```

**HTTP status codes for route handler responses:**
- `422` — invalid input or private IP range
- `502` — upstream API returned an error or unexpected response
- `404` — RDAP returned 404 (domain/IP not in registry)
- `200` — always success (no error in body)

**Do NOT use `{ data: null }` for errors** — if there's an error, return the `ApiError` shape with an appropriate status code.

### Private/Reserved IP Detection
`isPrivateIp(ip: string): boolean` lives in `src/lib/detect-input-type.ts` alongside `detectInputType`.

**Ranges to short-circuit (all of them):**
- RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- Loopback: `127.0.0.0/8`, `::1`
- Link-local: `169.254.0.0/16`, `fe80::/10`
- CGNAT: `100.64.0.0/10`
- Documentation/reserved: `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`
- Multicast: `224.0.0.0/4`
- IPv6 ULA: `fc00::/7`

**All 4 route handlers** call `isPrivateIp` before forwarding to upstream. Return:
```ts
return NextResponse.json(
  { error: { code: 'PRIVATE_IP', message: 'This is a private/reserved IP address — no external data available.' } },
  { status: 422 }
)
```

### ip-api.com Field Selection
Request all fields that Phase 2 cards need in one call — avoid a second request in Phase 2:
```
?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query
```
This covers CARD-01 requirements (country, city, region, ISP, org, ASN, timezone, lat/lon) in advance.

### detectInputType
`detectInputType(input: string): 'ipv4' | 'ipv6' | 'domain' | 'unknown'`

Input sanitization (strip before classification):
- Strip `https?://` prefix
- Strip trailing path (everything after first `/` post-domain)
- Trim whitespace

IPv6 PTR construction (`ip6.arpa`): expand to full 32 hex nibbles, remove colons, reverse, insert dots, append `.ip6.arpa`. Unit-test this function — nibble reversal is error-prone.

### Claude's Discretion
- Exact regex patterns for IPv4/IPv6/domain classification
- Whether to use a CIDR library or manual bitmask checks for private IP ranges
- `next.config.ts` configuration details (beyond defaults)
- ESLint and TypeScript config tuning

</decisions>

<specifics>
## Specific Ideas

- The `detectInputType` + `isPrivateIp` utilities both live in `src/lib/detect-input-type.ts` — one file, two exported functions
- RDAP routing: use `rdap.org` bootstrap for domains, `rdap.arin.net/registry/ip/{ip}` as first attempt for IPs (rdap.org bootstrap for IPs may redirect)
- RDAP graceful fallback: older ccTLDs may not support RDAP — return `{ error: { code: 'RDAP_NOT_SUPPORTED', message: 'WHOIS not available via RDAP for this TLD.' } }` rather than surfacing raw HTTP errors
- IPv6 PTR construction must be unit-tested before integration (expand → strip colons → reverse nibbles → dot-join → append `.ip6.arpa`)

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Stack
- `.planning/research/SUMMARY.md` — Full research summary: stack rationale, component map, critical pitfalls
- `.planning/research/ARCHITECTURE.md` — Component breakdown, server/client boundary decisions
- `.planning/research/STACK.md` — Framework versions, shadcn init command, next-themes setup

### Pitfalls to Avoid
- `.planning/research/PITFALLS.md` — ip-api.com HTTP-only constraint, Promise.allSettled requirement, DNS `Answer ?? []` guard, RDAP variability

### Requirements
- `.planning/REQUIREMENTS.md` — FOUND-01 through FOUND-08 with acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes them

### Integration Points
- Phase 2 (`useLookup` hook) will import `detectInputType` from `@/lib/detect-input-type`
- Phase 2 card components will parse `ApiError` shape from route handler responses
- Phase 2 will call all 4 route handlers via `fetch('/api/geo?q=...')` etc.

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within Phase 1 scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-21*
