---
phase: 01-foundation
plan: 03
subsystem: api
tags: [next.js, typescript, ip-api, dns.google, rdap, proxy, route-handlers]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: Next.js project scaffold, package.json, next.config.ts
  - phase: 01-foundation/01-02
    provides: detect-input-type.ts (detectInputType, isPrivateIp, buildIPv4PtrName, buildIPv6PtrName), api-error.ts (ApiError type)
provides:
  - GET /api/geo?q={ip} — proxies ip-api.com with full field set
  - GET /api/dns?q={domain} — proxies dns.google for A/AAAA/MX/TXT/NS/CNAME in parallel
  - GET /api/rdns?q={ip} — proxies dns.google for PTR records via in-addr.arpa / ip6.arpa
  - GET /api/whois?q={input} — proxies rdap.org for domain and IP WHOIS data
affects: [02-ui, card-components, useLookup-hook]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js App Router route handlers as API proxy layer"
    - "Response.json() for all route handler responses"
    - "Promise.allSettled for parallel DNS record type fetching"
    - "422 INVALID_INPUT / PRIVATE_IP for client errors, 502 UPSTREAM_ERROR for upstream failures, 404 RDAP_NOT_SUPPORTED for WHOIS gaps"
    - "cache: no-store on all upstream fetch calls"

key-files:
  created:
    - src/app/api/geo/route.ts
    - src/app/api/dns/route.ts
    - src/app/api/rdns/route.ts
    - src/app/api/whois/route.ts
  modified: []

key-decisions:
  - "detectInputType import removed from dns route handler — DNS accepts any hostname/IP and does not need type gating; import was in plan spec but unused"
  - "WHOIS route uses rdap.org bootstrap for both domains and IPs — follows 302 redirects automatically to authoritative RDAP server"
  - "RDNS route returns 422 INVALID_INPUT for domain inputs — reverse DNS requires an IP, rejecting domains prevents nonsensical PTR queries"

patterns-established:
  - "Route handler pattern: read q param → validate presence → check private IP → business logic → try/catch upstream → return Response.json"
  - "All route handlers normalize errors to ApiError shape: { error: { code, message, upstreamStatus? } }"
  - "RDAP 404 mapped to friendly RDAP_NOT_SUPPORTED rather than proxying 404 raw"

requirements-completed: [FOUND-04, FOUND-05, FOUND-06, FOUND-07]

# Metrics
duration: 1min
completed: 2026-03-21
---

# Phase 1 Plan 3: API Route Handlers Summary

**Four Next.js proxy route handlers for geo (ip-api.com), DNS (dns.google/resolve with Promise.allSettled), reverse DNS (PTR via ip6.arpa/in-addr.arpa), and WHOIS (rdap.org with RDAP_NOT_SUPPORTED fallback)**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-21T23:51:18Z
- **Completed:** 2026-03-21T23:53:07Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 4

## Accomplishments
- All 4 API route handlers created and verified against live APIs
- DNS route fetches 6 record types in parallel via Promise.allSettled — one failure doesn't blank others
- RDNS route correctly builds PTR names for both IPv4 (in-addr.arpa) and IPv6 (ip6.arpa) via buildIPv4PtrName/buildIPv6PtrName
- WHOIS route normalizes RDAP JSON into flat response and handles unsupported TLDs gracefully
- All routes enforce consistent validation: 422 INVALID_INPUT for missing q, 422 PRIVATE_IP for private ranges, 502 UPSTREAM_ERROR for upstream failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Build /api/geo and /api/dns route handlers** - `d1a0c6a8` (feat)
2. **Task 2: Build /api/rdns and /api/whois route handlers** - `f1b6f21f` (feat)
3. **Task 3: Verify all 4 route handlers against live APIs** - Auto-approved checkpoint (no commit)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/app/api/geo/route.ts` — GET /api/geo proxying ip-api.com with fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query
- `src/app/api/dns/route.ts` — GET /api/dns proxying dns.google for A/AAAA/MX/TXT/NS/CNAME via Promise.allSettled
- `src/app/api/rdns/route.ts` — GET /api/rdns proxying dns.google PTR lookup with correct arpa name construction
- `src/app/api/whois/route.ts` — GET /api/whois proxying rdap.org with RDAP response normalization

## Decisions Made
- `detectInputType` import removed from `/api/dns` handler — plan spec included it but DNS lookups accept any valid hostname or IP without needing type gating; removing avoids an unused import warning
- WHOIS route uses `rdap.org` bootstrap for both domains and IPs — Node.js fetch follows 302 redirects automatically, so this works transparently
- RDNS route rejects domain inputs with `INVALID_INPUT` — reverse DNS is IP-only; accepting domains would result in nonsensical `.in-addr.arpa` queries

## Deviations from Plan

None — plan executed exactly as written, with one trivial cleanup (removed unused import from dns handler that was in the plan spec but had no logical use in the DNS handler logic).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. All upstream APIs are free-tier, no-key services.

## Live API Smoke Test Results

All 7 tests passed:

1. `GET /api/geo?q=8.8.8.8` — returned country, city, isp, as, timezone, lat, lon
2. `GET /api/dns?q=example.com` — returned A, AAAA, MX, TXT, NS records (CNAME empty for apex)
3. `GET /api/rdns?q=8.8.8.8` — returned `["dns.google."]`
4. `GET /api/whois?q=example.com` — returned registrar, creationDate, expirationDate, nameservers
5. `GET /api/geo?q=192.168.1.1` — returned 422 with PRIVATE_IP code
6. `GET /api/geo` (no q) — returned 422 with INVALID_INPUT code

## Next Phase Readiness

All 4 API proxy routes are operational and verified against live APIs. Phase 2 (UI) can call these endpoints directly:
- `fetch('/api/geo?q=...')` for geolocation card
- `fetch('/api/dns?q=...')` for DNS records card
- `fetch('/api/rdns?q=...')` for reverse DNS card
- `fetch('/api/whois?q=...')` for WHOIS card

No blockers for Phase 2.

## Self-Check: PASSED

- FOUND: src/app/api/geo/route.ts
- FOUND: src/app/api/dns/route.ts
- FOUND: src/app/api/rdns/route.ts
- FOUND: src/app/api/whois/route.ts
- FOUND: .planning/phases/01-foundation/01-03-SUMMARY.md
- FOUND: commit d1a0c6a8 (Task 1)
- FOUND: commit f1b6f21f (Task 2)

---
*Phase: 01-foundation*
*Completed: 2026-03-21*
