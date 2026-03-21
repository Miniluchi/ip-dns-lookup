# Architecture Patterns

**Project:** IP/DNS Lookup Dashboard
**Domain:** Interactive on-demand lookup tool (Next.js App Router)
**Researched:** 2026-03-21
**Sources:** Next.js official docs v16.2.1 (nextjs.org, lastUpdated 2026-03-03 to 2026-03-20), training data for API specifics

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Browser (Client)                   │
│                                                     │
│  SearchBar ('use client')                           │
│    │ onChange → debounced input detection           │
│    │ onSubmit → fires 4 parallel fetches            │
│    ▼                                                │
│  DashboardGrid (Server Component shell)             │
│    ├── <Suspense fallback={<GeoSkeleton />}>        │
│    │     GeoCard ('use client' or async Server)     │
│    ├── <Suspense fallback={<DnsSkeleton />}>        │
│    │     DnsCard                                    │
│    ├── <Suspense fallback={<ReverseDnsSkeleton />}> │
│    │     ReverseDnsCard                             │
│    └── <Suspense fallback={<WhoisSkeleton />}>      │
│          WhoisCard                                  │
└─────────────────────────────────────────────────────┘
                         │
              4 parallel fetch() calls
                         │
┌─────────────────────────────────────────────────────┐
│            Next.js API Routes (Server)              │
│                                                     │
│  /api/geo?query=X      → proxies ip-api.com         │
│  /api/dns?query=X      → proxies dns.google DoH     │
│  /api/rdns?query=X     → proxies dns.google PTR     │
│  /api/whois?query=X    → proxies RDAP               │
└─────────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────┐
│              External Free APIs                     │
│                                                     │
│  http://ip-api.com/json/{ip}?fields=...             │
│  https://dns.google/resolve?name=X&type=A           │
│  https://dns.google/resolve?name=X&type=PTR         │
│  https://rdap.org/domain/{domain}                   │
│  https://rdap.arin.net/registry/ip/{ip}             │
└─────────────────────────────────────────────────────┘
```

---

## 1. API Route Handler Structure

Each lookup type gets its own route handler under `app/api/`. This is the correct approach for this project because:

- ip-api.com free tier only supports HTTP (not HTTPS), which would be mixed-content blocked from a browser
- The proxy layer normalizes error formats so each card gets consistent `{ data, error }` shape
- Rate limiting, logging, and future caching can be added at the proxy layer without touching UI code

**Recommended file structure:**

```
app/
  api/
    geo/
      route.ts          ← GET /api/geo?query=1.1.1.1
    dns/
      route.ts          ← GET /api/dns?query=example.com&type=A
    rdns/
      route.ts          ← GET /api/rdns?query=1.1.1.1
    whois/
      route.ts          ← GET /api/whois?query=example.com
```

**Pattern for each route handler:**

```typescript
// app/api/geo/route.ts
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')

  if (!query) {
    return Response.json({ error: 'query parameter required' }, { status: 400 })
  }

  try {
    // ip-api.com free tier is HTTP only — must go through server
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(query)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,isp,org,as,query`,
      { cache: 'no-store' }  // always fresh lookups
    )

    if (!res.ok) {
      return Response.json(
        { error: `Upstream error: ${res.status}` },
        { status: 502 }
      )
    }

    const data = await res.json()

    if (data.status === 'fail') {
      return Response.json({ error: data.message ?? 'Lookup failed' }, { status: 422 })
    }

    return Response.json(data)
  } catch (err) {
    return Response.json({ error: 'Failed to reach geo API' }, { status: 503 })
  }
}
```

**Key observations from official docs (HIGH confidence):**
- `cache: 'no-store'` is required. As of Next.js 15, GET route handlers default to **dynamic** (not cached), but making it explicit is safer for lookups that must always be fresh.
- `params` in route handlers is now a Promise in Next.js 15+. Use `request.nextUrl.searchParams` for query parameters — no `await` needed.
- The `Response.json()` static method is the correct return API.

**dns.google DoH handler:**

```typescript
// app/api/dns/route.ts
import { NextRequest } from 'next/server'

const RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'] as const

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')
  if (!query) {
    return Response.json({ error: 'query parameter required' }, { status: 400 })
  }

  // Fire all record type fetches in parallel on the server
  const results = await Promise.allSettled(
    RECORD_TYPES.map(async (type) => {
      const res = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(query)}&type=${type}`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error(`DNS ${type} fetch failed: ${res.status}`)
      const data = await res.json()
      return { type, answers: data.Answer ?? [] }
    })
  )

  const records: Record<string, unknown[]> = {}
  for (const [i, result] of results.entries()) {
    const type = RECORD_TYPES[i]
    records[type] = result.status === 'fulfilled' ? result.value.answers : []
  }

  return Response.json(records)
}
```

Note `Promise.allSettled` (not `Promise.all`) here — a missing MX record should not fail the entire DNS card.

**RDAP whois handler:**

```typescript
// app/api/whois/route.ts
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')
  if (!query) {
    return Response.json({ error: 'query parameter required' }, { status: 400 })
  }

  const isIp = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+$/.test(query)

  // RDAP has different endpoints for domains vs IPs
  const rdapUrl = isIp
    ? `https://rdap.arin.net/registry/ip/${encodeURIComponent(query)}`
    : `https://rdap.org/domain/${encodeURIComponent(query)}`

  try {
    const res = await fetch(rdapUrl, { cache: 'no-store' })

    if (res.status === 404) {
      return Response.json({ error: 'No WHOIS record found' }, { status: 404 })
    }
    if (!res.ok) {
      return Response.json({ error: `RDAP error: ${res.status}` }, { status: 502 })
    }

    return Response.json(await res.json())
  } catch (err) {
    return Response.json({ error: 'Failed to reach RDAP' }, { status: 503 })
  }
}
```

---

## 2. IP vs Domain Detection

This is client-side logic that runs before any API call. It determines which API routes to call and what input types to accept.

**Recommended regex approach:**

```typescript
// lib/detect-input-type.ts

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/
const IPV6_REGEX = /^[0-9a-fA-F]{1,4}(:[0-9a-fA-F]{0,4}){2,7}$/
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/

export type InputType = 'ipv4' | 'ipv6' | 'domain' | 'unknown'

export function detectInputType(input: string): InputType {
  const trimmed = input.trim()
  if (IPV4_REGEX.test(trimmed)) return 'ipv4'
  if (IPV6_REGEX.test(trimmed)) return 'ipv6'
  if (DOMAIN_REGEX.test(trimmed)) return 'domain'
  return 'unknown'
}
```

**Which cards are available per input type:**

| Input Type | Geo Card | DNS Card | Reverse DNS | WHOIS |
|------------|----------|----------|-------------|-------|
| IPv4       | Yes      | No       | Yes         | Yes (IP RDAP) |
| IPv6       | Partial  | No       | Yes         | Yes (IP RDAP) |
| Domain     | No (must resolve first) | Yes | No | Yes (domain RDAP) |
| Unknown    | Disabled | Disabled | Disabled    | Disabled |

**Note:** For domain input, geolocation requires resolving the domain to an IP first. This can be done in the geo route handler by calling dns.google to get the A record, then querying ip-api.com with the resolved IP. This keeps the client-side logic simple.

**Validation before submit:**

```typescript
'use client'
import { detectInputType } from '@/lib/detect-input-type'

function SearchBar() {
  const [query, setQuery] = useState('')
  const inputType = detectInputType(query)
  const isValid = inputType !== 'unknown' || query.length === 0

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter IP or domain..."
        className={!isValid && query.length > 0 ? 'border-red-500' : ''}
      />
      <button disabled={!isValid || query.length === 0}>Look up</button>
      {!isValid && query.length > 0 && (
        <p>Enter a valid IPv4, IPv6, or domain name</p>
      )}
    </form>
  )
}
```

---

## 3. Parallel Fetching from the Frontend

**Recommended approach: native `fetch` with `useState` + `useEffect`, or direct `Promise.allSettled` on submit.**

The two serious contenders are:

| Approach | Tradeoff | Recommendation |
|----------|----------|----------------|
| `Promise.allSettled` on submit | Simple, no library, per-card error isolation | **Use this** |
| SWR `useSWR` per card | Auto-retry, dedup, stale-while-revalidate | Overkill for on-demand lookup |
| React Query `useQuery` per card | Caching, background refresh, DevTools | Overkill for on-demand lookup |
| Server Components + `<Suspense>` | Server-driven, no client fetch | Wrong pattern (requires page navigation per lookup) |

**Rationale:** This is an *on-demand lookup tool*, not a data-fetching page. The user triggers a search, the 4 cards fire immediately and independently, and results are displayed. There is no background polling, cache invalidation, or automatic retry needed. SWR/React Query add complexity without benefit here. `Promise.allSettled` with per-card `useState` is the correct primitive.

**Recommended implementation pattern:**

```typescript
// hooks/use-lookup.ts
'use client'
import { useState, useCallback } from 'react'
import { detectInputType } from '@/lib/detect-input-type'

interface CardState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface LookupResults {
  geo: CardState<GeoData>
  dns: CardState<DnsData>
  rdns: CardState<ReverseDnsData>
  whois: CardState<WhoisData>
}

export function useLookup() {
  const [results, setResults] = useState<LookupResults>(initialState)

  const lookup = useCallback(async (query: string) => {
    const inputType = detectInputType(query)

    // Set all cards to loading
    setResults({
      geo: { data: null, loading: true, error: null },
      dns: { data: null, loading: true, error: null },
      rdns: { data: null, loading: true, error: null },
      whois: { data: null, loading: true, error: null },
    })

    // Fire all 4 fetches simultaneously
    const [geoResult, dnsResult, rdnsResult, whoisResult] = await Promise.allSettled([
      fetchCard('/api/geo', query),
      fetchCard('/api/dns', query),
      fetchCard('/api/rdns', query),
      fetchCard('/api/whois', query),
    ])

    // Update each card independently — one failure doesn't block others
    setResults({
      geo: settledToCardState(geoResult),
      dns: settledToCardState(dnsResult),
      rdns: settledToCardState(rdnsResult),
      whois: settledToCardState(whoisResult),
    })
  }, [])

  return { results, lookup }
}

async function fetchCard(path: string, query: string) {
  const res = await fetch(`${path}?query=${encodeURIComponent(query)}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json
}

function settledToCardState<T>(
  result: PromiseSettledResult<T>
): CardState<T> {
  if (result.status === 'fulfilled') {
    return { data: result.value, loading: false, error: null }
  }
  return { data: null, loading: false, error: result.reason?.message ?? 'Unknown error' }
}
```

**Why not per-card `useEffect` hooks:** Using `useEffect` for each card separately would require `useEffect` dependencies to include the query string, which triggers re-runs. The `Promise.allSettled` in a single callback is cleaner and makes the "all fire at once" intent explicit.

---

## 4. Server Components vs Client Components

**Decision: Hybrid architecture — server shell, client leaf components.**

This lookup dashboard is fundamentally interactive (user types, submits, sees results update without page navigation). This makes it primarily a Client Component concern. However, the page shell and layout should remain Server Components.

| Component | Type | Reason |
|-----------|------|--------|
| `app/page.tsx` | Server Component | Page shell, no interactivity |
| `components/SearchBar` | Client Component | Uses `useState`, `onChange`, `onSubmit` |
| `components/DashboardGrid` | Server Component (wrapper) | Static layout, passes children |
| `components/GeoCard` | Client Component | Receives state from `useLookup` hook |
| `components/DnsCard` | Client Component | Receives state from `useLookup` hook |
| `components/ReverseDnsCard` | Client Component | Receives state from `useLookup` hook |
| `components/WhoisCard` | Client Component | Receives state from `useLookup` hook |
| `components/LookupDashboard` | Client Component | Holds `useLookup`, renders all 4 cards |
| `lib/detect-input-type.ts` | Shared (no directive) | Pure function, no browser APIs |
| `app/api/*/route.ts` | Server (route handler) | API proxy, never runs on client |

**The "client component to the leaf" pattern from official docs applies here.** The page is:

```typescript
// app/page.tsx — Server Component
import LookupDashboard from '@/components/LookupDashboard'

export default function Page() {
  return (
    <main>
      <h1>IP & DNS Lookup</h1>
      <LookupDashboard />  {/* 'use client' subtree starts here */}
    </main>
  )
}
```

```typescript
// components/LookupDashboard.tsx — Client Component root
'use client'
import { useLookup } from '@/hooks/use-lookup'
import SearchBar from './SearchBar'
import GeoCard from './GeoCard'
import DnsCard from './DnsCard'
import ReverseDnsCard from './ReverseDnsCard'
import WhoisCard from './WhoisCard'

export default function LookupDashboard() {
  const { results, lookup } = useLookup()

  return (
    <div>
      <SearchBar onSearch={lookup} />
      <div className="grid grid-cols-2 gap-4">
        <GeoCard state={results.geo} />
        <DnsCard state={results.dns} />
        <ReverseDnsCard state={results.rdns} />
        <WhoisCard state={results.whois} />
      </div>
    </div>
  )
}
```

**Why not Server Component data fetching for this use case:**
Server Components fetch on the server at render time — they are ideal for data known at page load (e.g., a blog post ID from URL params). This dashboard fetches *on user input*, which happens after hydration. Server Components cannot re-fetch in response to client events without a full navigation. Use Client Components.

---

## 5. Error Boundary / Per-Card Error Handling

**Two-layer approach: render-level errors and fetch-level errors.**

### Layer 1: Per-card fetch errors (expected, handled in state)

The `useLookup` hook uses `Promise.allSettled` and stores per-card errors in state. Each card component checks its error state and renders an inline error UI. This handles the most common case: an API returned an error or the network failed for one card.

```typescript
// components/GeoCard.tsx
'use client'
import { Skeleton } from '@/components/ui/skeleton'
import type { CardState, GeoData } from '@/lib/types'

export default function GeoCard({ state }: { state: CardState<GeoData> }) {
  if (state.loading) return <GeoCardSkeleton />

  if (state.error) {
    return (
      <div className="rounded-lg border border-red-200 p-4">
        <h2 className="font-semibold text-red-600">Geolocation</h2>
        <p className="text-sm text-muted-foreground mt-1">{state.error}</p>
      </div>
    )
  }

  if (!state.data) return null  // Initial empty state

  return (
    <div className="rounded-lg border p-4">
      <h2 className="font-semibold">Geolocation</h2>
      {/* render geo data */}
    </div>
  )
}
```

### Layer 2: React error boundaries (unexpected rendering errors)

For unexpected errors (bugs in rendering code, malformed API response causing a crash), use `unstable_catchError` from `next/error` as documented in Next.js 16.x. This wraps individual cards at the component level — a crash in one card's render does not crash the others.

```typescript
// components/CardErrorBoundary.tsx
'use client'
import { unstable_catchError as catchError, type ErrorInfo } from 'next/error'

function CardErrorFallback(
  props: { title: string },
  { error, unstable_retry: retry }: ErrorInfo
) {
  return (
    <div className="rounded-lg border border-destructive p-4">
      <h2 className="font-semibold">{props.title}</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Unexpected error: {error.message}
      </p>
      <button
        onClick={() => retry()}
        className="mt-2 text-xs underline"
      >
        Try again
      </button>
    </div>
  )
}

export default catchError(CardErrorFallback)
```

Usage:

```typescript
// In LookupDashboard.tsx
import CardErrorBoundary from './CardErrorBoundary'

<CardErrorBoundary title="Geolocation">
  <GeoCard state={results.geo} />
</CardErrorBoundary>
```

**Note on `unstable_catchError`:** This API is present in Next.js 16.x docs (as of 2026-03-20) but carries the `unstable_` prefix, indicating it may change. Use it for fine-grained per-component error boundaries. The stable alternative is a `class ErrorBoundary extends React.Component` — either works.

**The stable class-based alternative if `unstable_catchError` feels risky:**

```typescript
'use client'
import React from 'react'

interface Props { title: string; children: React.ReactNode }
interface State { hasError: boolean; message: string }

export default class CardErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-destructive p-4">
          <h2 className="font-semibold">{this.props.title}</h2>
          <p className="text-sm">{this.state.message}</p>
          <button onClick={() => this.setState({ hasError: false, message: '' })}>
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

---

## 6. Loading Skeleton Patterns

**Use shadcn/ui `<Skeleton />` component for card-level skeletons.**

The shadcn/ui Skeleton component renders an animated pulse placeholder. Install with `npx shadcn@latest add skeleton`.

**Pattern: one skeleton component per card, matching the card's expected visual structure.**

```typescript
// components/GeoCardSkeleton.tsx
import { Skeleton } from '@/components/ui/skeleton'

export function GeoCardSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <Skeleton className="h-5 w-1/3" />          {/* Card title */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />         {/* Country row */}
        <Skeleton className="h-4 w-4/5" />          {/* City row */}
        <Skeleton className="h-4 w-3/5" />          {/* ISP row */}
        <Skeleton className="h-4 w-2/3" />          {/* ASN row */}
      </div>
    </div>
  )
}
```

**Skeleton shapes match data shapes:** DNS card has more rows (6 record types), WHOIS card has date fields, etc. Each card gets its own skeleton component sized to the expected data.

**Skeleton display trigger:** The skeleton renders when `state.loading === true`. Since all 4 cards start loading simultaneously on submit, all 4 skeletons appear at the same instant — good UX.

**Do NOT use `<Suspense>` for skeleton display in this architecture.** Because data fetching happens on the client (in `useLookup`), there are no server-side suspended promises to wrap. `<Suspense>` is for server-side streaming or the React `use()` API. Using it here would require a different architecture (Server Actions or server-fetched promises passed to client). For client-triggered fetches, `state.loading` conditional rendering is the correct pattern.

---

## 7. CORS: Why All Lookups Must Go Through Next.js API Routes

**CORS is the primary reason to proxy through API routes. This is mandatory, not optional.**

### ip-api.com

ip-api.com free tier:
- Only supports **HTTP** (not HTTPS). Direct browser fetch to `http://` from an HTTPS page is blocked as mixed content — regardless of CORS headers.
- Even if HTTPS were available on free tier, free tier does not include CORS headers that allow arbitrary origins.
- **Conclusion:** Must proxy through `/api/geo`. The Next.js server fetches over HTTP without mixed-content restrictions.

(Confidence: MEDIUM — based on known ip-api.com free tier restrictions. The HTTP-only limitation for free tier is well-established. Unable to verify current CORS headers directly due to tool restrictions, but the mixed-content issue alone makes proxying mandatory.)

### dns.google (DoH)

dns.google:
- Supports HTTPS natively (`https://dns.google/resolve`)
- Does send CORS headers that allow browser-direct access (it's a public JSON API designed for browser use)
- **Could** be called directly from the browser without a proxy
- **Recommendation:** Still proxy through `/api/dns` for consistency, centralized error handling, and to avoid leaking the user's query to Google directly from their browser

### RDAP

RDAP endpoints (rdap.org, rdap.arin.net, etc.):
- Support HTTPS
- Most RDAP bootstrap servers do send permissive CORS headers (RDAP is designed for web clients)
- **Could** be called directly from browser in theory
- **Recommendation:** Still proxy through `/api/whois` for consistent error normalization and to handle RDAP bootstrap redirects server-side (RDAP may redirect to a registrar's own RDAP server)

### Summary decision table

| API | HTTP only? | CORS from browser? | Must proxy? |
|-----|-----------|-------------------|-------------|
| ip-api.com (free) | YES — HTTP only | No | **Yes — mandatory** |
| dns.google | No — HTTPS | Yes (public API) | Recommended for consistency |
| RDAP (rdap.org) | No — HTTPS | Yes (mostly) | Recommended for normalization |

**The right architecture is to proxy all 4 through Next.js routes.** This creates a uniform interface (`/api/{type}?query=X` returning `{ data } | { error }`) regardless of upstream differences. It also means switching APIs later (e.g., from ip-api.com to MaxMind) only changes the route handler, not the UI.

---

## Component Boundaries

| Component | File | Responsibility | Type |
|-----------|------|---------------|------|
| `Page` | `app/page.tsx` | Page shell, static layout | Server |
| `LookupDashboard` | `components/LookupDashboard.tsx` | Holds lookup state, renders grid | Client |
| `SearchBar` | `components/SearchBar.tsx` | Input, validation, submit trigger | Client |
| `GeoCard` | `components/GeoCard.tsx` | Renders geo data or skeleton or error | Client |
| `DnsCard` | `components/DnsCard.tsx` | Renders DNS records or skeleton or error | Client |
| `ReverseDnsCard` | `components/ReverseDnsCard.tsx` | Renders PTR data or skeleton or error | Client |
| `WhoisCard` | `components/WhoisCard.tsx` | Renders WHOIS/RDAP data or skeleton or error | Client |
| `CardErrorBoundary` | `components/CardErrorBoundary.tsx` | Per-card React error boundary | Client |
| `*Skeleton` | `components/*Skeleton.tsx` | Static skeleton shapes | Client (co-located) |
| `useLookup` | `hooks/use-lookup.ts` | Fetch orchestration, `Promise.allSettled` | Client hook |
| `detectInputType` | `lib/detect-input-type.ts` | Regex detection, returns 'ipv4'/'ipv6'/'domain'/'unknown' | Shared |
| `/api/geo/route.ts` | `app/api/geo/route.ts` | Proxy to ip-api.com | Route Handler |
| `/api/dns/route.ts` | `app/api/dns/route.ts` | Proxy to dns.google, all record types in parallel | Route Handler |
| `/api/rdns/route.ts` | `app/api/rdns/route.ts` | Proxy to dns.google PTR records | Route Handler |
| `/api/whois/route.ts` | `app/api/whois/route.ts` | Proxy to RDAP (domain or IP) | Route Handler |

---

## Data Flow

```
User types query
    │
    ▼
detectInputType(query) → 'ipv4' | 'ipv6' | 'domain' | 'unknown'
    │
    ▼
User submits (Enter or button click)
    │
    ▼
useLookup.lookup(query) called
    │
    ├── setResults({ all loading: true })
    │
    └── Promise.allSettled([
            fetch('/api/geo?query=X'),
            fetch('/api/dns?query=X'),
            fetch('/api/rdns?query=X'),
            fetch('/api/whois?query=X'),
        ])
              │
              │ (all 4 fire simultaneously, resolve independently)
              │
              ▼
        setResults({
          geo: { data, loading: false, error }  ← from settled[0]
          dns: { data, loading: false, error }  ← from settled[1]
          rdns: { data, loading: false, error } ← from settled[2]
          whois: { data, loading: false, error }← from settled[3]
        })
              │
              ▼
    Each Card component re-renders
    with data | error | loading state
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct browser fetch to ip-api.com
**What:** Calling `http://ip-api.com/json/...` directly from client-side JavaScript.
**Why bad:** Blocked by mixed content policy on HTTPS pages. Fails silently in production.
**Instead:** Always proxy through `/api/geo`.

### Anti-Pattern 2: Sequential await for card data
**What:**
```typescript
const geo = await fetch('/api/geo?query=X')
const dns = await fetch('/api/dns?query=X')  // waits for geo
const rdns = await fetch('/api/rdns?query=X')  // waits for dns
const whois = await fetch('/api/whois?query=X')  // waits for rdns
```
**Why bad:** Slowest API determines total wait time. If ip-api.com takes 800ms, DNS and WHOIS (which could complete in 200ms) are delayed unnecessarily.
**Instead:** `Promise.allSettled([...])` so all 4 fire simultaneously.

### Anti-Pattern 3: Using `Promise.all` instead of `Promise.allSettled`
**What:** `await Promise.all([geo, dns, rdns, whois])` — if any single fetch throws, all 4 results are lost.
**Why bad:** One failed API (e.g., RDAP returning 404) throws an error that rejects the entire `Promise.all`, leaving all 4 cards in the loading state permanently.
**Instead:** `Promise.allSettled` — each card gets its own `fulfilled | rejected` result.

### Anti-Pattern 4: One route handler for all lookup types
**What:** A single `/api/lookup?query=X&type=geo|dns|rdns|whois` endpoint.
**Why bad:** Forces sequential handling server-side if you want to aggregate results. Harder to test, harder to add caching per type, harder to swap one API without affecting others.
**Instead:** Four separate route handlers, each independently responsible.

### Anti-Pattern 5: Fetching all data in a Server Component
**What:** Making the page an `async` Server Component that fetches all 4 APIs on page load.
**Why bad:** The search is interactive — user enters a query *after* the page loads. Server Components cannot respond to client events without full page navigation. The page would need to be a URL-param-driven route (`/lookup/[query]`) which breaks the single-page UX.
**Instead:** Client-triggered `useLookup` hook.

### Anti-Pattern 6: Per-card `useEffect` with query dependency
**What:**
```typescript
// In GeoCard.tsx
useEffect(() => {
  fetch(`/api/geo?query=${query}`)
    .then(r => r.json())
    .then(setData)
}, [query])
```
**Why bad:** Couples data fetching to component lifecycle. Cards fire independently rather than together, making it hard to show all 4 skeletons at the same instant. Race conditions if query changes before fetch completes.
**Instead:** Centralized `useLookup` hook with `Promise.allSettled`.

---

## Scalability Considerations

| Concern | Current (personal tool) | If made public |
|---------|------------------------|----------------|
| ip-api.com rate limit | 45 req/min (free, unregistered) | Must upgrade or switch to pro |
| dns.google rate limit | No documented limit | May need caching layer |
| RDAP availability | Varies by registrar | Cache results for N minutes |
| Server-side caching | Not needed (single user) | Add `cache: 'force-cache'` + `revalidate: 300` |
| Vercel function timeout | Default 10s (Hobby tier) | RDAP can be slow — monitor |

For the personal tool use case, no changes are needed beyond what is described. All four API routes should use `cache: 'no-store'` because lookup results must always be current.

---

## Sources

- Next.js Route Handlers API Reference: https://nextjs.org/docs/app/api-reference/file-conventions/route (v16.2.1, 2026-03-03, HIGH confidence)
- Next.js Data Fetching Patterns: https://nextjs.org/docs/app/getting-started/fetching-data (v16.2.1, 2026-03-13, HIGH confidence)
- Next.js Error Handling: https://nextjs.org/docs/app/getting-started/error-handling (v16.2.1, 2026-03-20, HIGH confidence)
- Next.js Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components (v16.2.1, 2026-03-03, HIGH confidence)
- Next.js Caching: https://nextjs.org/docs/app/getting-started/caching (v16.2.1, 2026-03-13, HIGH confidence)
- ip-api.com CORS and HTTP-only restriction: MEDIUM confidence — WebFetch was blocked for ip-api.com; HTTP-only free tier is widely documented behavior but not verified from official docs in this session
- dns.google DoH CORS: MEDIUM confidence — known public API designed for browser use; CORS headers not verified in this session
- RDAP CORS behavior: LOW confidence — RDAP is designed for web clients but individual registry server CORS policies vary; proxying eliminates this uncertainty
- shadcn/ui Skeleton component: MEDIUM confidence — component exists and `npx shadcn@latest add skeleton` is the standard install pattern; exact API not verified from official shadcn docs in this session (WebFetch blocked for ui.shadcn.com)
