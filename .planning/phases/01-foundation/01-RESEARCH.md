# Phase 1: Foundation - Research

**Researched:** 2026-03-21
**Domain:** Next.js 15 App Router — scaffold, API route handlers, input detection utilities
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Project Structure**
- Use `src/` subdirectory: `src/app/`, `src/components/`, `src/hooks/`, `src/lib/`
- Bootstrap command: `create-next-app@latest --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- Import alias: `@/*` maps to `src/`
- shadcn/ui components: `src/components/ui/` (default shadcn path — do not override)
- shadcn style: New York, CSS variables enabled

**Tech Stack (locked)**
- Next.js 15+ App Router
- TypeScript strict mode
- Tailwind CSS v4
- shadcn/ui (New York)
- next-themes (dark mode without FOUC)
- No external data-fetching library — native `fetch` + `Promise.allSettled`

**API Proxy Architecture (locked)**
- All external API calls go through Next.js route handlers — mandatory because ip-api.com free tier is HTTP-only (mixed content blocked on HTTPS)
- Never call ip-api.com directly from the browser
- Route handlers are the only place that knows upstream API URLs
- `Promise.allSettled` used at both layers: in `useLookup` hook (Phase 2) and inside `/api/dns/route.ts` for parallel record types

**Normalized Error Shape (shared across all 4 handlers)**
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

HTTP status codes:
- `422` — invalid input or private IP range
- `502` — upstream API returned an error or unexpected response
- `404` — RDAP returned 404 (domain/IP not in registry)
- `200` — always success (no error in body)

Do NOT use `{ data: null }` for errors — if there's an error, return the `ApiError` shape with an appropriate status code.

**Private/Reserved IP Detection**
`isPrivateIp(ip: string): boolean` lives in `src/lib/detect-input-type.ts` alongside `detectInputType`.

Ranges to short-circuit:
- RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- Loopback: `127.0.0.0/8`, `::1`
- Link-local: `169.254.0.0/16`, `fe80::/10`
- CGNAT: `100.64.0.0/10`
- Documentation/reserved: `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`
- Multicast: `224.0.0.0/4`
- IPv6 ULA: `fc00::/7`

All 4 route handlers call `isPrivateIp` before forwarding to upstream. Return 422 with PRIVATE_IP code.

**ip-api.com Field Selection**
```
?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query
```

**detectInputType**
`detectInputType(input: string): 'ipv4' | 'ipv6' | 'domain' | 'unknown'`

Input sanitization (strip before classification):
- Strip `https?://` prefix
- Strip trailing path (everything after first `/` post-domain)
- Trim whitespace

IPv6 PTR construction (`ip6.arpa`): expand to full 32 hex nibbles, remove colons, reverse, insert dots, append `.ip6.arpa`. Unit-test this function.

### Claude's Discretion
- Exact regex patterns for IPv4/IPv6/domain classification
- Whether to use a CIDR library or manual bitmask checks for private IP ranges
- `next.config.ts` configuration details (beyond defaults)
- ESLint and TypeScript config tuning

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within Phase 1 scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Project scaffolded with Next.js 14+ App Router, TypeScript, Tailwind CSS, and shadcn/ui | Scaffold command verified; versions confirmed live from npm registry |
| FOUND-02 | `detectInputType(input)` utility correctly identifies IPv4, IPv6, and domain inputs | Regex patterns documented; ARCHITECTURE.md provides working implementation |
| FOUND-03 | Input sanitization strips `https?://` prefixes and trailing paths before querying | Simple string manipulation; pattern provided in Code Examples section |
| FOUND-04 | `GET /api/geo?q={ip}` route handler proxies ip-api.com and returns geolocation data | ip-api.com HTTP-only constraint verified; fields parameter confirmed; ARCHITECTURE.md provides route handler template |
| FOUND-05 | `GET /api/dns?q={domain}` route handler proxies dns.google for A, AAAA, MX, TXT, NS, CNAME records | dns.google endpoint confirmed; `Answer ?? []` guard documented; `Promise.allSettled` per record type confirmed |
| FOUND-06 | `GET /api/rdns?q={ip}` route handler performs PTR lookup via dns.google | PTR via dns.google confirmed; `in-addr.arpa` / `ip6.arpa` construction documented |
| FOUND-07 | `GET /api/whois?q={input}` route handler queries RDAP and returns registration data | rdap.org URL format verified live (`/domain/{d}`, `/ip/{ip}`); RDAP redirect behavior confirmed |
| FOUND-08 | Private/reserved IP ranges are detected and short-circuited before API calls | All ranges listed in Locked Decisions; implementation approach documented |
</phase_requirements>

---

## Summary

Phase 1 is a greenfield scaffold + backend proxy layer. All decisions are locked; this research confirms the locked choices against current sources and fills in implementation-level specifics the planner needs.

The three plans are naturally ordered: (1) scaffold the project and install all tooling, (2) implement `detectInputType` + `isPrivateIp` as pure utilities, (3) build all 4 route handlers. Plans 2 and 3 have no UI — they are pure TypeScript files verifiable via `curl` and unit tests.

The main risks are: IPv6 PTR nibble reversal (unit-test before integrating), RDAP's 302 redirect behavior (rdap.org acts as a bootstrap that 302s to the authoritative server — server-side `fetch` follows redirects by default, which is correct behavior), and the ip-api.com HTTP-only constraint (mandatory proxy, confirmed from official docs).

**Primary recommendation:** Follow the locked architecture exactly. Use `request.nextUrl.searchParams` (no await) for query params in route handlers. Use manual bitmask checks for private IP ranges rather than a CIDR library — the range list is fixed and small enough that a table-driven approach with arithmetic is simpler and adds no dependency.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.1 | Full-stack framework — App Router, route handlers | Verified live from npm registry 2026-03-21 |
| react | 19 (bundled with next) | UI library | Bundled by Next.js; no separate install |
| typescript | 5.9.3 | Type safety | Verified live from npm registry 2026-03-21 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwindcss | 4.2.2 | Utility-first CSS | Selected by `create-next-app --tailwind` for new projects |
| shadcn (CLI) | 4.1.0 | Copies editable component source into project | Run `npx shadcn@latest init` after scaffold |
| next-themes | 0.4.6 | Dark/light mode without FOUC | Locked — wraps root layout with ThemeProvider |

### No Runtime Data-Fetching Library
By design (locked decision) — native `fetch` + `Promise.allSettled` only. Do not install SWR or React Query.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual bitmask private IP checks | `ip-cidr` or `cidr-matcher` npm package | Manual arithmetic is simpler for a fixed range table; avoids a dependency |
| Manual IPv6 regex | `is-ip` npm package | Training data suggests `is-ip` 4.x is well-maintained, but regex approach avoids dependency for Phase 1's classification needs |

**Installation:**
```bash
# Step 1: Scaffold
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Step 2: Initialize shadcn/ui
npx shadcn@latest init -t next

# Step 3: Add components needed in Phase 1 (minimal — just what route handlers indirectly shape)
# Phase 1 has no UI — skip component adds until Phase 2. Only init is needed now.

# Step 4: Add next-themes
npm install next-themes
```

**Version verification (confirmed 2026-03-21):**
- `next`: 16.2.1
- `shadcn` (CLI): 4.1.0
- `next-themes`: 0.4.6
- `typescript`: 5.9.3
- `tailwindcss`: 4.2.2

---

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    api/
      geo/
        route.ts          # GET /api/geo?q={ip} — proxies ip-api.com
      dns/
        route.ts          # GET /api/dns?q={domain} — proxies dns.google (6 record types in parallel)
      rdns/
        route.ts          # GET /api/rdns?q={ip} — proxies dns.google PTR
      whois/
        route.ts          # GET /api/whois?q={input} — proxies RDAP
    layout.tsx            # Root layout with ThemeProvider, suppressHydrationWarning
    page.tsx              # Server Component shell — renders <LookupDashboard />
    globals.css           # Tailwind v4 @import + shadcn CSS variable tokens
  components/
    theme-provider.tsx    # 'use client' wrapper for next-themes ThemeProvider
    ui/                   # shadcn-generated components (do not manually edit)
  lib/
    detect-input-type.ts  # detectInputType + isPrivateIp — two exports, one file
    api-error.ts          # ApiError type shared by all 4 route handlers
    utils.ts              # cn() helper (created by shadcn init)
  hooks/                  # (empty in Phase 1 — useLookup goes here in Phase 2)
```

### Pattern 1: Route Handler for Proxy
**What:** Each route handler reads a query param `q`, validates it, calls `isPrivateIp` if applicable, proxies to the external API, and returns a normalized shape.
**When to use:** All 4 route handlers follow this exact structure.

```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/route (v16.2.1, 2026-03-03)
import type { NextRequest } from 'next/server'
import { isPrivateIp } from '@/lib/detect-input-type'

export async function GET(request: NextRequest) {
  // Query params via nextUrl.searchParams — no await needed (unlike path params)
  const q = request.nextUrl.searchParams.get('q')

  if (!q) {
    return Response.json(
      { error: { code: 'INVALID_INPUT', message: 'q parameter is required' } },
      { status: 422 }
    )
  }

  if (isPrivateIp(q)) {
    return Response.json(
      { error: { code: 'PRIVATE_IP', message: 'This is a private/reserved IP address — no external data available.' } },
      { status: 422 }
    )
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(q)}?fields=...`, {
      cache: 'no-store'   // lookups must always be fresh; Next.js 15 GET handlers default to dynamic anyway
    })
    if (!res.ok) {
      return Response.json(
        { error: { code: 'UPSTREAM_ERROR', message: 'Upstream API error', upstreamStatus: res.status } },
        { status: 502 }
      )
    }
    const data = await res.json()
    if (data.status === 'fail') {
      return Response.json(
        { error: { code: 'UPSTREAM_ERROR', message: data.message ?? 'Lookup failed' } },
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
```

**Key confirmed detail:** `params` in dynamic segments requires `await params` in Next.js 15+, but `request.nextUrl.searchParams` does NOT require await. All 4 route handlers use query params (not path segments), so no `await params` is ever needed in this project.

### Pattern 2: DNS Parallel Record Fetching
**What:** `/api/dns` fires 6 record-type requests simultaneously via `Promise.allSettled`. A missing CNAME or MX does not fail the other types.
**When to use:** Only the DNS route handler — other handlers proxy a single endpoint.

```typescript
// Source: ARCHITECTURE.md + pitfall from PITFALLS.md (verified against dns.google DoH docs)
const RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'] as const

const results = await Promise.allSettled(
  RECORD_TYPES.map(async (type) => {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(q)}&type=${type}`,
      { cache: 'no-store' }
    )
    if (!res.ok) throw new Error(`DNS ${type} fetch failed: ${res.status}`)
    const data = await res.json()
    return { type, answers: data.Answer ?? [] }  // Answer may be absent on NXDOMAIN (Status 3)
  })
)
```

### Pattern 3: RDAP Routing with 302 Follow
**What:** rdap.org acts as a bootstrap: it returns a 302 redirect to the authoritative RDAP server. Node.js `fetch` follows redirects by default (up to 20 hops). No special handling needed.
**When to use:** `/api/whois` for both domains and IPs.

```
https://rdap.org/domain/{domain}   → 302 → authoritative registrar RDAP
https://rdap.org/ip/{ip}           → 302 → ARIN/RIPE/APNIC/etc. RDAP server
```

Confirmed from rdap.org official page (2026-03-21): URL format is `https://rdap.org/<type>/<object>` where type is one of `domain`, `ip`, `autnum`, `entity`.

### Pattern 4: IPv6 PTR Construction
**What:** Convert an IPv6 address to its `ip6.arpa` PTR name for reverse DNS lookup.
**When to use:** `/api/rdns` when `detectInputType` returns `'ipv6'`.

```
Input:   2001:4860:4860::8888
Step 1:  Expand to 32 hex digits: 20014860486000000000000000008888
Step 2:  Split into nibbles: 2 0 0 1 4 8 6 0 4 8 6 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 8 8 8 8
Step 3:  Reverse: 8 8 8 8 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 6 8 4 0 6 8 4 1 0 0 2
Step 4:  Join with dots: 8.8.8.8.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.6.8.4.0.6.8.4.1.0.0.2
Step 5:  Append: 8.8.8.8.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.6.8.4.0.6.8.4.1.0.0.2.ip6.arpa
```

This transformation MUST be unit-tested. The expand step (handling `::` abbreviation) is the most error-prone part.

### Anti-Patterns to Avoid
- **Using `Promise.all` instead of `Promise.allSettled` in `/api/dns`:** One NXDOMAIN record type blanks the whole DNS response.
- **Awaiting `request.searchParams` / awaiting params in non-dynamic routes:** `request.nextUrl.searchParams` is synchronous. Only dynamic path `params` require `await`.
- **Calling `http://ip-api.com` from browser code:** Blocked as mixed content on HTTPS. Must go through `/api/geo`.
- **Returning `{ data: null }` for errors:** Use `ApiError` shape with non-200 status instead.
- **Surfacing raw RDAP HTTP errors:** When rdap.org returns 404 for an unsupported TLD, return `{ error: { code: 'RDAP_NOT_SUPPORTED', message: 'WHOIS not available via RDAP for this TLD.' } }`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS dark mode token system | Custom CSS variable scheme | shadcn/ui CSS variables + `next-themes` | shadcn's CSS variable system integrates with Tailwind's `dark:` variant automatically |
| Tailwind class deduplication | Manual string concat | `cn()` from `@/lib/utils` (created by shadcn init, uses `clsx` + `tailwind-merge`) | `twMerge` handles conflicting Tailwind class precedence correctly |
| ThemeProvider hydration fix | Custom `localStorage` theme script | `next-themes` with `suppressHydrationWarning` on `<html>` | `next-themes` handles SSR/client theme mismatch; `suppressHydrationWarning` suppresses React's class attribute mismatch warning |

**Key insight:** All utility infrastructure (class merging, dark mode, component primitives) is provided by the scaffold + shadcn init. Phase 1 hand-rolls only the 4 proxy route handlers and 2 pure utility functions, which are the genuinely custom work.

---

## Common Pitfalls

### Pitfall 1: ip-api.com HTTP-Only (mandatory proxy)
**What goes wrong:** Developer calls `http://ip-api.com/json/...` directly from client JS. Works in local dev over HTTP, silently fails in Vercel production (HTTPS page blocks HTTP fetch as mixed content).
**Why it happens:** Free tier is HTTP-only; HTTPS requires paid plan. Verified from official ip-api.com docs 2026-03-21.
**How to avoid:** `/api/geo/route.ts` is the ONLY place that calls ip-api.com. Client code only calls `/api/geo?q=...`.
**Warning signs:** `net::ERR_BLOCKED_BY_RESPONSE` in browser console; works in dev but not prod.

### Pitfall 2: `Answer` Array Missing on NXDOMAIN
**What goes wrong:** `data.Answer.map(...)` throws `TypeError: Cannot read properties of undefined`.
**Why it happens:** dns.google returns `Status: 3` (NXDOMAIN) with no `Answer` key when a record type doesn't exist for a domain.
**How to avoid:** Always guard: `data.Answer ?? []`. Confirmed from Google DoH JSON API docs.
**Warning signs:** DNS card crashes or shows error for domains that genuinely have no MX/CNAME records.

### Pitfall 3: IPv6 PTR Nibble Reversal
**What goes wrong:** PTR lookup returns wrong hostname or NXDOMAIN for valid IPv6 addresses.
**Why it happens:** IPv6 expansion (handling `::`) and nibble reversal are easy to get wrong — especially for addresses with multiple `::` segments or leading zeros.
**How to avoid:** Write the `expandIPv6` helper separately from `buildIPv6PtrName`. Unit-test both with: `::1`, `2001:4860:4860::8888`, `fe80::1`, `2001:db8::`.
**Warning signs:** Unit tests for PTR construction fail; `curl /api/rdns?q=::1` returns error or wrong PTR.

### Pitfall 4: RDAP TLD Coverage Gaps
**What goes wrong:** `/api/whois?q=example.de` returns a raw 404 or 500, confusing the user.
**Why it happens:** Older ccTLDs (`.de`, `.uk` legacy, some country TLDs) may not support RDAP. rdap.org returns 404 when no RDAP server exists for the TLD.
**How to avoid:** Check `res.status === 404` explicitly and return `{ error: { code: 'RDAP_NOT_SUPPORTED', message: 'WHOIS not available via RDAP for this TLD.' } }` with status 404.
**Warning signs:** Whois card shows raw HTTP error instead of friendly message.

### Pitfall 5: shadcn `init` Prompt — `components.json` Alignment
**What goes wrong:** Import paths in generated components don't match the project's `tsconfig` `@/*` alias, causing module-not-found errors.
**Why it happens:** shadcn init asks for path aliases; if the default is accepted but doesn't match the `create-next-app` alias, generated component imports break.
**How to avoid:** When `npx shadcn@latest init` prompts for aliases, confirm it matches `@/*` → `./src/*`. The `--import-alias "@/*"` flag in `create-next-app` sets this in `tsconfig.json`; shadcn reads `tsconfig.json` to pre-fill the alias — accept the default.
**Warning signs:** `Module not found: Can't resolve '@/components/ui/button'`.

### Pitfall 6: `cache: 'no-store'` Omission in Route Handlers
**What goes wrong:** Geo or DNS results are cached from a previous lookup and served stale for a different IP/domain.
**Why it happens:** While Next.js 15 GET handlers default to dynamic (not cached), explicitly marking `cache: 'no-store'` on each upstream `fetch()` call ensures no intermediate caching — especially relevant if Vercel's edge caches are involved.
**How to avoid:** Include `{ cache: 'no-store' }` on every upstream `fetch()` call inside route handlers.
**Warning signs:** Same result returned for two different IP queries within a short window.

---

## Code Examples

Verified patterns from official sources:

### Route Handler — Query Params (No Await)
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/route (v16.2.1, 2026-03-03)
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // searchParams is synchronous on NextRequest — no await needed
  const q = request.nextUrl.searchParams.get('q')
  // ...
}
```

### ApiError Shared Type
```typescript
// Source: CONTEXT.md locked decision
// src/lib/api-error.ts
export type ApiError = {
  error: {
    code: string
    message: string
    upstreamStatus?: number
  }
}
```

### ip-api.com Field String
```
// Source: ip-api.com docs (verified 2026-03-21) + CONTEXT.md locked decision
http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query
```

### dns.google PTR for IPv4 Reverse DNS
```
// Source: PITFALLS.md + dns.google DoH docs
// IPv4 reverse: reverse octets + ".in-addr.arpa"
// 8.8.8.8 → 8.8.8.8.in-addr.arpa
https://dns.google/resolve?name=8.8.8.8.in-addr.arpa&type=PTR
```

### RDAP URL Format (confirmed live 2026-03-21)
```
// Source: https://about.rdap.org/ (verified 2026-03-21)
https://rdap.org/domain/{domain}    // e.g. rdap.org/domain/example.com
https://rdap.org/ip/{ip}           // e.g. rdap.org/ip/8.8.8.8
// rdap.org returns 302 → authoritative RDAP server → Node fetch follows automatically
```

### next-themes Root Layout Integration
```tsx
// Source: STACK.md (from Next.js official docs, HIGH confidence)
// src/app/layout.tsx
import { ThemeProvider } from '@/components/theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### detectInputType — Input Sanitization
```typescript
// Sanitize before calling detectInputType (or inside it)
function sanitize(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')     // strip protocol
    .split('/')[0]                     // strip path
    .split('?')[0]                     // strip query string
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pages/api/` route files | `app/api/*/route.ts` route handlers | Next.js 13 (App Router GA: Next.js 13.4) | Route handlers use Web Request/Response APIs instead of Node req/res objects |
| Synchronous params in route handlers | `params` is a `Promise` in route handlers | Next.js 15.0.0-RC | Must `await params` for dynamic path segments; `searchParams` on `NextRequest` is still synchronous |
| `cache: 'force-cache'` default for GET handlers | Dynamic (no cache) default for GET handlers | Next.js 15.0.0-RC | Route handler GET responses are not cached by default — `{ cache: 'no-store' }` is the explicit/safe choice for lookup tools |
| `npx shadcn-ui@latest` (old package name) | `npx shadcn@latest` (new package name) | shadcn 1.x → 2.x | Use `shadcn`, not `shadcn-ui` |
| Tailwind `tailwind.config.js` + `darkMode: ["class"]` | Tailwind v4: `@import "tailwindcss"` + `@custom-variant dark` in CSS | Tailwind CSS v4 | New project uses CSS-first config; no `tailwind.config.js` needed |

**Deprecated/outdated:**
- `npx shadcn-ui@latest`: replaced by `npx shadcn@latest`. The old package name still works as a redirect but the canonical CLI is `shadcn`.
- `pages/api/*.ts`: Do not use — project uses App Router.

---

## Open Questions

1. **RDAP `as` field format from ip-api.com**
   - What we know: ip-api.com returns `as` as a string like `"AS15169 Google LLC"`. CONTEXT.md notes ASN should be parsed via `^(AS\d+)\s+(.+)$`.
   - What's unclear: This parsing is Phase 2 card rendering logic — Phase 1 route handler passes the raw `as` string through unchanged. No open question for Phase 1.
   - Recommendation: Pass raw `as` field from ip-api.com unchanged in Phase 1. Phase 2 parses it.

2. **shadcn init exact prompts for New York style with Tailwind v4**
   - What we know: CLI command is `npx shadcn@latest init -t next`. The `-t next` flag sets the Next.js template.
   - What's unclear: Exact interactive prompts (style selection, base color) when using `-t next` with Tailwind v4 — shadcn.com documentation doesn't enumerate them.
   - Recommendation: Run the init interactively, select "New York" style and "Neutral" base color when prompted, CSS variables = yes. Accept the default alias detection (it reads `tsconfig.json`).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (preferred for Next.js 15 + TypeScript projects in 2026) or Jest |
| Config file | None yet — Wave 0 gap |
| Quick run command | `npx vitest run src/lib/detect-input-type.test.ts` |
| Full suite command | `npx vitest run` |

**Rationale for Vitest:** Vitest is ESM-native, works without Babel transform, and integrates with TypeScript without additional config. Jest requires `ts-jest` or `babel-jest` for `.ts` files.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-02 | `detectInputType('192.168.1.1')` returns `'ipv4'` | unit | `npx vitest run src/lib/detect-input-type.test.ts` | ❌ Wave 0 |
| FOUND-02 | `detectInputType('2001:4860:4860::8888')` returns `'ipv6'` | unit | same | ❌ Wave 0 |
| FOUND-02 | `detectInputType('example.com')` returns `'domain'` | unit | same | ❌ Wave 0 |
| FOUND-02 | `detectInputType('unknown text')` returns `'unknown'` | unit | same | ❌ Wave 0 |
| FOUND-03 | `detectInputType('https://example.com/path')` sanitizes to `'domain'` | unit | same | ❌ Wave 0 |
| FOUND-08 | `isPrivateIp('192.168.1.1')` returns `true` | unit | `npx vitest run src/lib/detect-input-type.test.ts` | ❌ Wave 0 |
| FOUND-08 | `isPrivateIp('8.8.8.8')` returns `false` | unit | same | ❌ Wave 0 |
| FOUND-08 | `isPrivateIp('::1')` returns `true` | unit | same | ❌ Wave 0 |
| FOUND-04 | `curl http://localhost:3000/api/geo?q=8.8.8.8` returns JSON with country, city, ISP, ASN fields | smoke (curl) | manual curl | N/A |
| FOUND-05 | `curl http://localhost:3000/api/dns?q=example.com` returns A, AAAA, MX, TXT, NS, CNAME arrays | smoke (curl) | manual curl | N/A |
| FOUND-06 | `curl http://localhost:3000/api/rdns?q=8.8.8.8` returns PTR hostname | smoke (curl) | manual curl | N/A |
| FOUND-07 | `curl http://localhost:3000/api/whois?q=example.com` returns registrar, dates | smoke (curl) | manual curl | N/A |

IPv6 PTR construction also needs unit tests (error-prone, explicitly flagged in CONTEXT.md):
| Behavior | Test Type | Command |
|----------|-----------|---------|
| `buildIPv6PtrName('::1')` returns `'1.0.0...0.ip6.arpa'` | unit | `npx vitest run src/lib/detect-input-type.test.ts` |
| `buildIPv6PtrName('2001:4860:4860::8888')` | unit | same |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/detect-input-type.test.ts` (unit tests only, ~1s)
- **Per wave merge:** `npx vitest run` (all tests)
- **Phase gate:** Full suite green + all 4 curl smoke tests passing before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/detect-input-type.test.ts` — covers FOUND-02, FOUND-03, FOUND-08, IPv6 PTR construction
- [ ] `vitest.config.ts` — framework config (or inline vitest config in `package.json`)
- [ ] Framework install: `npm install -D vitest` — no test framework detected in new project

---

## Sources

### Primary (HIGH confidence)
- Next.js official docs v16.2.1 — route handlers, `params` Promise type, `request.nextUrl.searchParams`, `cache: 'no-store'`, `Response.json()` API: https://nextjs.org/docs/app/api-reference/file-conventions/route (fetched 2026-03-21)
- npm registry live queries (2026-03-21): next@16.2.1, shadcn@4.1.0, next-themes@0.4.6, typescript@5.9.3, tailwindcss@4.2.2
- ip-api.com docs (fetched 2026-03-21): HTTP-only confirmed for free tier, private range response confirmed, fields parameter format confirmed
- rdap.org (fetched 2026-03-21): URL format `https://rdap.org/<type>/<object>` confirmed; 302 redirect behavior confirmed

### Secondary (MEDIUM confidence)
- shadcn/ui Next.js installation guide: https://ui.shadcn.com/docs/installation/next (fetched 2026-03-21) — CLI command `npx shadcn@latest init -t next` confirmed; exact prompts for style selection not enumerated in fetched content
- Google DoH JSON API: https://developers.google.com/speed/public-dns/docs/doh/json (fetched 2026-03-21) — `Answer` array structure confirmed; NXDOMAIN example not shown in fetched excerpt
- .planning/research/STACK.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md — prior research from same session (2026-03-21); Next.js official docs cited as source

### Tertiary (LOW confidence)
- Vitest recommendation for Phase 1 test framework — training data + general ecosystem knowledge; no official Next.js testing docs fetched in this session. Alternative: Jest with ts-jest.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified live from npm registry
- Architecture: HIGH — route handler patterns verified from Next.js official docs v16.2.1; proxy rationale confirmed from ip-api.com official docs
- API schemas: MEDIUM — ip-api.com fields and rdap.org URL format verified live; dns.google `Answer` array confirmed from docs but NXDOMAIN example not in fetched excerpt
- Pitfalls: HIGH — ip-api.com HTTP-only confirmed from official source; all other pitfalls have HIGH correlation with official docs or prior-session research
- Test framework: LOW — Vitest recommendation from training data only; not verified from official Next.js testing docs

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable APIs; rdap.org bootstrap behavior could change but is unlikely)
