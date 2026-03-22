# Phase 2: Core UI - Research

**Researched:** 2026-03-22
**Domain:** React hooks, shadcn/ui components, Next.js 16 App Router client components, Tailwind CSS v4
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Hook architecture**
- `useLookup` hook manages all state; `CardState<T>` type per card with `{ status: 'idle' | 'loading' | 'success' | 'error', data: T | null, error: string | null }`
- `Promise.allSettled` at hook level — one card's failure must never affect others
- `detectInputType` called inside hook to determine which cards are shown/hidden
- Hook returns a map of per-card states plus a top-level `isLoading` boolean

**Search bar behavior**
- Button label: "Search"; placeholder: "IP address or domain…"
- During loading: input is disabled (read-only) + Search button shows a spinner icon; prevents double-fire
- Validation: client-side check before API calls — if input is empty or `detectInputType` returns `'unknown'`, show inline red error text below the bar ("Enter a valid IP address or domain") and make no API calls
- No clear (x) button on the input

**Card visibility**
- Cards irrelevant to input type are removed from the DOM entirely — grid reflows
- Rules: `ReverseDnsCard` hidden for `'domain'` inputs; all 4 cards shown for `'ipv4'` / `'ipv6'` inputs

**Card skeletons**
- Use shadcn `Skeleton` component with shimmer animation
- Each card shows 4-5 grey shimmer bars that approximate the shape of the card's real data layout
- Skeleton is rendered when `CardState.status === 'loading'`

**Card error state**
- Rendered when `CardState.status === 'error'`
- Layout: warning icon (e.g. `AlertCircle` from lucide-react) + `CardState.error` text
- No retry button — user re-fires by submitting the search bar again
- All error codes (`PRIVATE_IP`, `UPSTREAM_ERROR`, `INVALID_INPUT`) display identically — just show `ApiError.error.message`

**GeoCard fields**
- Show all 9 fields: country, city, region, ISP, org, AS/ASN, timezone, lat, lon
- Layout: label/value rows (e.g. `<dt>Country</dt><dd>United States</dd>`)

**DnsCard display**
- Hide empty record types — only render a section if the type has >= 1 record
- Each non-empty type gets a section header (e.g. "A Records")
- Records displayed as table rows: `| data | TTL |` per record

**WHOIS card**
- Show: registrar, creation date, expiry date, nameservers, EPP status codes
- EPP codes shown as-is (raw strings, e.g. `clientTransferProhibited`) — no translation in Phase 2

### Claude's Discretion
- Exact skeleton bar heights and widths per card
- Exact shadcn component choices within cards (Card, CardHeader, CardContent, etc.)
- Icon choice for error state (AlertCircle or similar from lucide-react)
- Typography scale for field labels vs values inside cards
- Exact Tailwind classes for spacing, colors, borders

### Deferred Ideas (OUT OF SCOPE)
- Retry button per card — Phase 3 or backlog
- URL `?q=` param sync — Phase 3 (SRCH-03)
- Auto-populate "My IP" on load — Phase 3 (SRCH-04)
- Dark/light mode toggle UI — Phase 3 (UI-02)
- Copy-to-clipboard on record values — Phase 3 (UI-03)
- TXT record highlighting (SPF/DKIM/DMARC) — v2 (ENH-01)
- EPP code plain-English translation — v2 (ENH-02)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-01 | Single search bar accepts any IP address or domain name | `detectInputType` + controlled `<input>` in `LookupDashboard`; validation path documented |
| SRCH-02 | Pressing Enter or clicking Search fires all 4 lookups in parallel via `Promise.allSettled` | `Promise.allSettled` pattern verified in existing `/api/dns/route.ts`; replicate at hook level |
| CARD-01 | Geolocation card displays country, city, region, ISP, org, ASN, timezone, lat/lon | `/api/geo` response shape confirmed: flat fields on success object |
| CARD-02 | DNS Records card displays all record types in grouped, readable format | `/api/dns` returns `{ records: { A, AAAA, MX, TXT, NS, CNAME } }`; hide-if-empty pattern documented |
| CARD-03 | Reverse DNS card displays PTR hostname(s) for IP inputs | `/api/rdns` returns `{ ptr: string[] }`; hidden for domain inputs per card-visibility rule |
| CARD-04 | WHOIS card displays registrar, creation date, expiry date, nameservers, EPP status | `/api/whois` response shape confirmed: `name, registrar, creationDate, expirationDate, status[], nameservers[]` |
| CARD-05 | Each card shows a loading skeleton while its API call is in flight | shadcn `Skeleton` component install path documented; render when `status === 'loading'` |
| CARD-06 | Each card shows an inline error state if its API call fails (other cards unaffected) | `Promise.allSettled` guarantees isolation; error shape from `ApiError.error.message` |
| CARD-07 | Cards irrelevant to input type are hidden (Reverse DNS hidden for domain input) | `detectInputType` result drives conditional rendering; DOM removal (not CSS hide) |
| UI-01 | 2x2 card grid layout on desktop, single column on mobile | Tailwind: `grid grid-cols-1 md:grid-cols-2 gap-4`; confirmed in CONTEXT.md specifics |
| UI-04 | Modern shadcn/ui visual design — no default/unstyled components | shadcn Card, CardHeader, CardContent, CardTitle established; Skeleton add command documented |
</phase_requirements>

---

## Summary

Phase 2 is a pure React/Next.js client-side build that wires together already-complete API routes with a new hook and four card components. The foundational infrastructure (API routes, `detectInputType`, `ApiError` type, shadcn Button, `ThemeProvider`) is in place and verified by reading the actual source files. No new third-party dependencies are required — all needed libraries (`lucide-react`, `shadcn`, `next-themes`) are already installed.

The core technical challenge is the `useLookup` hook: it must call `detectInputType` on the submitted query to (a) gate validation and (b) determine which cards receive API calls. `Promise.allSettled` ensures the four fetch calls are fully independent at the settled-result level — a rejected promise does not propagate to sibling cards. The hook must track `CardState<T>` per card rather than a single shared state object to enable independent loading/error states.

The shadcn `Skeleton` component is not yet installed (only `Button` is in `src/components/ui/`). It must be added via `npx shadcn@latest add skeleton card` before the card implementations can be written. The existing shadcn setup uses the base-nova v4 preset with CSS variables, so adding components follows the standard `npx shadcn@latest add` flow.

**Primary recommendation:** Build in the order: (1) `useLookup` hook, (2) `LookupDashboard` component, (3) four card components. The hook is the dependency bottleneck — cards consume `CardState<T>` props, so the hook interface must be stable before cards are written.

---

## Standard Stack

### Core (all already installed — verified from package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.1 | App Router, Server + Client Components | Project foundation; page.tsx is the mount point |
| react | 19.2.4 | useState, useCallback hooks | Client component interactivity |
| lucide-react | 0.577.0 | AlertCircle, Loader2 icons for error/spinner states | Already installed; project-standard icon set |
| shadcn (CLI) | 4.1.0 | Component installation (Skeleton, Card) | Already configured with base-nova preset |
| tailwindcss | ^4 | Utility classes for grid, spacing, responsive layout | Project-standard; Tailwind v4 CSS-first config |
| next-themes | 0.4.6 | ThemeProvider already in layout — dark mode works | Already wired; no new work needed |

### Components to Install (via shadcn CLI)

| Component | Install Command | Purpose |
|-----------|----------------|---------|
| skeleton | `npx shadcn@latest add skeleton` | Shimmer bars inside each card during loading |
| card | `npx shadcn@latest add card` | Card, CardHeader, CardContent, CardTitle wrappers for each lookup card |

**Verify before running:** shadcn base-nova v4 is already initialized. Run `npx shadcn@latest add skeleton card` from the project root. Both will write to `src/components/ui/`.

### No New npm Dependencies Required

All needed packages are installed. Do not add new packages for this phase.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── hooks/
│   └── use-lookup.ts          # useLookup hook — CardState<T>, Promise.allSettled
├── components/
│   ├── lookup-dashboard.tsx   # 'use client' — search bar + card grid
│   ├── geo-card.tsx           # GeoCard — consumes CardState<GeoData>
│   ├── dns-card.tsx           # DnsCard — consumes CardState<DnsData>
│   ├── rdns-card.tsx          # ReverseDnsCard — consumes CardState<RdnsData>
│   ├── whois-card.tsx         # WhoisCard — consumes CardState<WhoisData>
│   └── ui/
│       ├── button.tsx         # Already installed
│       ├── skeleton.tsx       # Add via: npx shadcn@latest add skeleton
│       └── card.tsx           # Add via: npx shadcn@latest add card
├── lib/
│   ├── detect-input-type.ts   # detectInputType, sanitizeInput (already exists)
│   └── api-error.ts           # ApiError type (already exists)
└── app/
    └── page.tsx               # Mounts <LookupDashboard /> — Server Component
```

### Pattern 1: CardState<T> Type Definition

**What:** A discriminated-union-style state object per card that drives three rendering branches.
**When to use:** Any time a single async operation must show idle / loading / success / error UI.

```typescript
// src/hooks/use-lookup.ts
import type { ApiError } from '@/lib/api-error'

export type CardState<T> = {
  status: 'idle' | 'loading' | 'success' | 'error'
  data: T | null
  error: string | null
}

export function idleCard<T>(): CardState<T> {
  return { status: 'idle', data: null, error: null }
}
```

### Pattern 2: useLookup Hook with Promise.allSettled

**What:** A custom hook that holds state for all 4 cards, fires fetch calls in parallel, and maps settled results back to per-card state.
**When to use:** Any time multiple independent async operations should update state separately.

```typescript
// src/hooks/use-lookup.ts
import { useState, useCallback } from 'react'
import { detectInputType, sanitizeInput } from '@/lib/detect-input-type'

// InputType returned by detectInputType determines which cards are shown
export type InputType = 'ipv4' | 'ipv6' | 'domain' | 'unknown'

export type LookupState = {
  geo: CardState<GeoData>
  dns: CardState<DnsData>
  rdns: CardState<RdnsData>
  whois: CardState<WhoisData>
}

export function useLookup() {
  const [state, setState] = useState<LookupState>({
    geo: idleCard(),
    dns: idleCard(),
    rdns: idleCard(),
    whois: idleCard(),
  })
  const [inputType, setInputType] = useState<InputType>('unknown')
  const [isLoading, setIsLoading] = useState(false)

  const lookup = useCallback(async (raw: string) => {
    const q = sanitizeInput(raw)
    const type = detectInputType(q)
    setInputType(type)

    if (!q || type === 'unknown') {
      // Validation error — caller handles UI; hook does nothing
      return { valid: false }
    }

    // Set all visible cards to loading
    const loadingCard: CardState<never> = { status: 'loading', data: null, error: null }
    setState({
      geo: loadingCard,
      dns: loadingCard,
      rdns: type !== 'domain' ? loadingCard : idleCard(),
      whois: loadingCard,
    })
    setIsLoading(true)

    const fetchCard = async <T>(url: string): Promise<CardState<T>> => {
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok || json.error) {
        return { status: 'error', data: null, error: json.error?.message ?? 'Unknown error' }
      }
      return { status: 'success', data: json as T, error: null }
    }

    const [geo, dns, rdns, whois] = await Promise.allSettled([
      fetchCard<GeoData>(`/api/geo?q=${encodeURIComponent(q)}`),
      fetchCard<DnsData>(`/api/dns?q=${encodeURIComponent(q)}`),
      type !== 'domain'
        ? fetchCard<RdnsData>(`/api/rdns?q=${encodeURIComponent(q)}`)
        : Promise.resolve(idleCard<RdnsData>()),
      fetchCard<WhoisData>(`/api/whois?q=${encodeURIComponent(q)}`),
    ])

    setState({
      geo: geo.status === 'fulfilled' ? geo.value : { status: 'error', data: null, error: 'Request failed' },
      dns: dns.status === 'fulfilled' ? dns.value : { status: 'error', data: null, error: 'Request failed' },
      rdns: rdns.status === 'fulfilled' ? rdns.value : { status: 'error', data: null, error: 'Request failed' },
      whois: whois.status === 'fulfilled' ? whois.value : { status: 'error', data: null, error: 'Request failed' },
    })
    setIsLoading(false)
    return { valid: true }
  }, [])

  return { state, inputType, isLoading, lookup }
}
```

**Note:** The `fetchCard` helper catches HTTP error responses via `!res.ok || json.error` — this converts API `ApiError` shape (`{ error: { code, message } }`) into `CardState.error` string. Network-level failures (fetch throws) are NOT caught inside `fetchCard`; they will cause the outer `Promise.allSettled` to record `status: 'rejected'` for that slot, handled by the fallback in `setState`.

### Pattern 3: LookupDashboard Client Component

**What:** The single `'use client'` component that owns the search bar + card grid. Mounted from `page.tsx` as its only child.
**When to use:** The root of all interactive state in App Router.

```typescript
// src/components/lookup-dashboard.tsx
'use client'

import { useState } from 'react'
import { useLookup } from '@/hooks/use-lookup'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { GeoCard } from '@/components/geo-card'
import { DnsCard } from '@/components/dns-card'
import { ReverseDnsCard } from '@/components/rdns-card'
import { WhoisCard } from '@/components/whois-card'

export function LookupDashboard() {
  const [input, setInput] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const { state, inputType, isLoading, lookup } = useLookup()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    const result = await lookup(input)
    if (!result.valid) {
      setValidationError('Enter a valid IP address or domain')
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="IP address or domain…"
            disabled={isLoading}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm ..."
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
            Search
          </Button>
        </div>
        {validationError && (
          <p className="mt-1 text-sm text-destructive">{validationError}</p>
        )}
      </form>

      <div className="mt-8 grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-2">
        <GeoCard state={state.geo} />
        <DnsCard state={state.dns} />
        {inputType !== 'domain' && <ReverseDnsCard state={state.rdns} />}
        <WhoisCard state={state.whois} />
      </div>
    </main>
  )
}
```

### Pattern 4: Card Component Rendering Branches

**What:** Each card renders one of three branches — skeleton, error, or data — based on `CardState.status`.
**When to use:** All four card components follow this identical structural pattern.

```typescript
// Example: src/components/geo-card.tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle } from 'lucide-react'
import type { CardState } from '@/hooks/use-lookup'
import type { GeoData } from '@/hooks/use-lookup'

export function GeoCard({ state }: { state: CardState<GeoData> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Geolocation</CardTitle>
      </CardHeader>
      <CardContent>
        {state.status === 'idle' && (
          <p className="text-sm text-muted-foreground">Enter an IP or domain above.</p>
        )}
        {state.status === 'loading' && <GeoSkeleton />}
        {state.status === 'error' && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span className="text-sm">{state.error}</span>
          </div>
        )}
        {state.status === 'success' && state.data && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Country</dt>
            <dd>{state.data.country}</dd>
            {/* ... remaining 8 fields */}
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
```

### Pattern 5: DnsCard Hide-Empty-Type Logic

**What:** Only render record type sections where the array has >= 1 entry.
**When to use:** DnsCard only — other cards don't have this variable-section requirement.

```typescript
// Inside DnsCard success branch
const RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'] as const

{RECORD_TYPES.filter(type => (state.data!.records[type]?.length ?? 0) > 0).map(type => (
  <section key={type}>
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-3 mb-1">
      {type} Records
    </h3>
    <table className="w-full text-sm">
      <tbody>
        {state.data!.records[type].map((rec, i) => (
          <tr key={i}>
            <td className="font-mono">{rec.data}</td>
            <td className="text-right text-muted-foreground">{rec.TTL}s</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
))}
```

### Anti-Patterns to Avoid

- **Shared loading state across all cards:** A single `isLoading` boolean must not control card-level rendering. Each card reads its own `CardState.status`. The top-level `isLoading` is only for disabling the search bar input/button.
- **Promise.all instead of Promise.allSettled:** `Promise.all` rejects on the first failure. Use `Promise.allSettled` exclusively.
- **Fetching inside card components:** Cards must be pure presentational components. All fetch logic lives in `useLookup`.
- **Server Component with 'use client' hook:** `LookupDashboard` must declare `'use client'` at the top — it uses `useState` and `useCallback`. `page.tsx` stays a Server Component and just renders `<LookupDashboard />`.
- **Conditional hook calls:** The rdns card visibility must NOT be implemented by conditionally calling a hook. `useLookup` always fires (or skips) all fetches; the grid conditionally renders `<ReverseDnsCard>` based on `inputType`.
- **Using CSS `display: none` for card visibility:** The decision is to remove from DOM entirely — use `{inputType !== 'domain' && <ReverseDnsCard ... />}`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shimmer skeleton animation | Custom CSS keyframes | shadcn `Skeleton` component | Shimmer animation is complex, has accessibility implications; shadcn's handles it with Tailwind animate |
| Card container markup | Raw `<div>` with manual classes | shadcn `Card`, `CardHeader`, `CardContent`, `CardTitle` | Consistent border, shadow, radius, dark mode CSS variables handled automatically |
| Input spinner CSS | Custom spinner div | `lucide-react` `Loader2` with `animate-spin` Tailwind class | Already installed; `animate-spin` is built into Tailwind |
| Error icon | Custom SVG | `lucide-react` `AlertCircle` | Already installed; consistent with project icon set |
| Dark mode CSS variables | Manual color tokens | shadcn CSS variable system (`bg-background`, `text-muted-foreground`, `text-destructive`) | Already configured via base-nova preset; do not hardcode hex values |

**Key insight:** Every "custom solution" listed above requires maintaining CSS that already exists through shadcn + Tailwind + lucide-react. The project already has all three installed.

---

## API Response Type Reference

These are the exact shapes returned by each route handler (verified by reading source):

### GeoData (from `/api/geo`)
```typescript
type GeoData = {
  status: string
  country: string; countryCode: string
  region: string; regionName: string
  city: string; zip: string
  lat: number; lon: number
  timezone: string
  isp: string; org: string
  as: string    // e.g. "AS15169 Google LLC"
  query: string
}
```
Display mapping: `country`, `city`, `regionName` (label: "Region"), `isp` (label: "ISP"), `org` (label: "Org"), `as` (label: "AS"), `timezone`, `lat`, `lon`.

### DnsData (from `/api/dns`)
```typescript
type DnsRecord = { name: string; data: string; TTL: number }
type DnsData = {
  records: {
    A: DnsRecord[]; AAAA: DnsRecord[]; MX: DnsRecord[]
    TXT: DnsRecord[]; NS: DnsRecord[]; CNAME: DnsRecord[]
  }
}
```

### RdnsData (from `/api/rdns`)
```typescript
type RdnsData = { ptr: string[] }
```
Display: list of PTR hostnames. If `ptr` is empty array, show "No PTR records found."

### WhoisData (from `/api/whois`)
```typescript
type WhoisData = {
  name: string
  registrar: string | null
  creationDate: string | null    // ISO 8601 date string
  expirationDate: string | null  // ISO 8601 date string
  lastChanged: string | null
  status: string[]               // EPP status codes
  nameservers: string[]
  raw: unknown
}
```
Display: `registrar`, `creationDate` (label: "Created"), `expirationDate` (label: "Expires"), `nameservers` (as `<ul>`), `status` as individual `<code>` tags.

**Note on null fields:** Any of the WHOIS fields can be `null` (RDAP coverage varies). Render `—` or "N/A" for null values rather than crashing or showing empty strings.

---

## Common Pitfalls

### Pitfall 1: Stale Closure in Promise.allSettled Callback
**What goes wrong:** The `setState` call inside the async function captures stale state if the user submits again before results return from the first lookup.
**Why it happens:** React's `setState` from closure captures the state reference at call time.
**How to avoid:** Use the functional form of `setState` where needed, or abort previous requests with `AbortController` — though the simpler approach is to disable the input while `isLoading` is true (already a locked decision). The `disabled` input/button prevents double-fire, making this a non-issue in normal use.
**Warning signs:** Partial state updates where some cards show old data alongside new data.

### Pitfall 2: shadcn Skeleton Not Yet Installed
**What goes wrong:** Import of `@/components/ui/skeleton` fails at build/runtime — file does not exist yet.
**Why it happens:** Only `button.tsx` exists in `src/components/ui/` (verified). `skeleton` and `card` must be added.
**How to avoid:** Run `npx shadcn@latest add skeleton card` as the first task of the implementation wave (Wave 0 / setup step).
**Warning signs:** Module not found error at `@/components/ui/skeleton`.

### Pitfall 3: WhoisData null Field Rendering
**What goes wrong:** `null` values for `registrar`, `creationDate`, etc. render as blank or cause runtime errors if passed directly to string contexts.
**Why it happens:** RDAP does not guarantee all fields; older TLDs return sparse data.
**How to avoid:** Apply a fallback: `{data.registrar ?? '—'}` for scalar fields; `{data.nameservers.length > 0 ? ... : '—'}` for arrays.
**Warning signs:** Empty table cells or blank sections in the WHOIS card.

### Pitfall 4: DnsCard Empty Records Object
**What goes wrong:** Accessing `state.data.records.A` without checking existence — TypeScript type says it's there but API could return empty arrays.
**Why it happens:** The filter (`type.length > 0`) is the correct guard; forgetting it causes empty sections to render.
**How to avoid:** Always filter record types before rendering sections.

### Pitfall 5: RdnsData PTR Empty Array
**What goes wrong:** `state.data.ptr` can be an empty array `[]` on a successful 200 response when no PTR record exists for the IP.
**Why it happens:** dns.google returns an empty `Answer` field — the route returns `{ ptr: [] }` as a valid success.
**How to avoid:** In `ReverseDnsCard`, check `data.ptr.length === 0` explicitly and display "No PTR records found." instead of an empty list.

### Pitfall 6: isLoading boolean mismatch
**What goes wrong:** `isLoading` remains `true` after an error because `setIsLoading(false)` is placed only on the success path.
**Why it happens:** Missing `finally` block or forgetting to reset in the error branch.
**How to avoid:** Use a `try/finally` pattern or always call `setIsLoading(false)` after the `Promise.allSettled` resolves, regardless of individual card outcomes.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `vitest.config.ts` (exists — uses `globals: true`, `environment: 'node'`, `@` alias) |
| Quick run command | `npm test` (vitest run --passWithNoTests) |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-01 | Search bar validates input and blocks unknown type | unit | `npm test -- src/hooks/use-lookup.test.ts` | Wave 0 |
| SRCH-02 | `lookup()` fires all 4 fetches in parallel via Promise.allSettled | unit | `npm test -- src/hooks/use-lookup.test.ts` | Wave 0 |
| CARD-05 | Cards independently show `status: 'loading'` | unit | `npm test -- src/hooks/use-lookup.test.ts` | Wave 0 |
| CARD-06 | One failed fetch sets that card to error; others succeed | unit | `npm test -- src/hooks/use-lookup.test.ts` | Wave 0 |
| CARD-07 | `lookup()` returns `rdns: idle` for domain input type | unit | `npm test -- src/hooks/use-lookup.test.ts` | Wave 0 |
| CARD-01-04 | Card data fields render correctly | manual-only | Verify in browser — `npm run dev` | N/A |
| UI-01 | 2-column grid on desktop, 1-column on mobile | manual-only | Browser DevTools responsive mode | N/A |
| UI-04 | No unstyled components visible | manual-only | Browser visual inspection | N/A |

**Manual-only justification:** Rendering tests require a browser DOM environment (jsdom). The vitest config uses `environment: 'node'` — switching to jsdom for React component rendering would require `@testing-library/react` and environment changes not established in Phase 1. Hook logic (pure functions + state) is fully testable in node environment with `vi.fn()` mocking of `fetch`.

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/use-lookup.test.ts` — covers SRCH-01, SRCH-02, CARD-05, CARD-06, CARD-07
- [ ] `npx shadcn@latest add skeleton card` — must run before any card component can import these

*(Existing `detect-input-type.test.ts` covers the utility functions that `useLookup` depends on — no gap there.)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn new-york style | shadcn base-nova preset (v4) | shadcn v4 release | CSS variables system unchanged; component usage same; init already done |
| React 18 hooks | React 19 hooks (same API) | React 19.2.4 installed | No API difference for useState/useCallback used here |
| Tailwind JIT config (tailwind.config.js) | Tailwind v4 CSS-first (globals.css @import) | Tailwind v4 | No `tailwind.config.js` needed; use utility classes normally |

**Deprecated/outdated:**
- `next/image` with `layout="fill"`: not relevant here but noted — App Router uses standard `<Image>` props
- shadcn `new-york` style: replaced by `base-nova` in v4 — do not use `new-york` style selectors

---

## Open Questions

1. **shadcn `card` component exact sub-component names**
   - What we know: shadcn Card components typically export `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
   - What's unclear: exact export names for base-nova v4 preset (may differ from shadcn v2 docs)
   - Recommendation: After running `npx shadcn@latest add card`, read the generated file before using sub-components

2. **vitest + React hooks without jsdom**
   - What we know: `useLookup` uses `useState` and `useCallback` — these require React's runtime
   - What's unclear: whether vitest node environment can run React hooks with `renderHook` from `@testing-library/react`
   - Recommendation: Test hook logic by extracting the pure fetch-orchestration function as a testable helper; mock `fetch` globally with `vi.fn()`. Alternatively, add `@testing-library/react` + jsdom to devDependencies for hook tests — this is low-risk and standard.

---

## Sources

### Primary (HIGH confidence)
- Source file read: `src/lib/detect-input-type.ts` — exact function signatures and exports verified
- Source file read: `src/lib/api-error.ts` — exact `ApiError` type verified
- Source file read: `src/app/api/geo/route.ts` — exact success response shape verified
- Source file read: `src/app/api/dns/route.ts` — exact `{ records: {...} }` shape verified
- Source file read: `src/app/api/rdns/route.ts` — exact `{ ptr: string[] }` shape verified
- Source file read: `src/app/api/whois/route.ts` — exact response fields verified
- Source file read: `src/components/ui/button.tsx` — Button import path and props verified
- Source file read: `package.json` — all installed dependency versions verified
- Source file read: `vitest.config.ts` — test environment and alias configuration verified
- `npm view shadcn version` → 4.1.0 (current registry version matches installed)
- `npm view lucide-react version` → 0.577.0 (current registry version matches installed)

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions section — locked implementation choices from user discussion
- Glob `src/components/ui/` — confirmed only `button.tsx` exists; `skeleton` and `card` must be installed

### Tertiary (LOW confidence)
- shadcn Card sub-component names (CardHeader, CardContent, CardTitle) — based on training knowledge; must be verified after `npx shadcn@latest add card` generates the file

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified from package.json and npm registry
- Architecture: HIGH — API response shapes read from actual source files; hook pattern derived from existing `Promise.allSettled` usage in `/api/dns/route.ts`
- Pitfalls: HIGH — all pitfalls derived from actual code analysis (null WHOIS fields, missing skeleton install, empty PTR arrays)
- Test approach: MEDIUM — vitest + node environment limitation noted; workaround documented

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack — Next.js, React, shadcn, lucide-react all pinned in package.json)
