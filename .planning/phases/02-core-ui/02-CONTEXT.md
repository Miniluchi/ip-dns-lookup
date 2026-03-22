# Phase 2: Core UI - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the client-side orchestration and card UI that makes the product functional: a `useLookup` hook that fires all 4 API calls in parallel, a `LookupDashboard` client component with search bar and 2×2 card grid, and 4 card components (`GeoCard`, `DnsCard`, `ReverseDnsCard`, `WhoisCard`). Each card independently shows skeleton → data or error. Phase 2 ends when typing an IP/domain and pressing Enter populates all 4 cards with live data simultaneously.

</domain>

<decisions>
## Implementation Decisions

### Hook architecture
- `useLookup` hook manages all state; `CardState<T>` type per card with `{ status: 'idle' | 'loading' | 'success' | 'error', data: T | null, error: string | null }`
- `Promise.allSettled` at hook level — one card's failure must never affect others
- `detectInputType` called inside hook to determine which cards are shown/hidden
- Hook returns a map of per-card states plus a top-level `isLoading` boolean

### Search bar behavior
- Button label: **"Search"**; placeholder: **"IP address or domain…"**
- **During loading:** input is disabled (read-only) + Search button shows a spinner icon; prevents double-fire
- **Validation:** client-side check before API calls — if input is empty or `detectInputType` returns `'unknown'`, show inline red error text below the bar ("Enter a valid IP address or domain") and make no API calls
- No clear (×) button on the input

### Card visibility
- Cards irrelevant to input type are **removed from the DOM entirely** — grid reflows
- Rules: `ReverseDnsCard` hidden for `'domain'` inputs; all 4 cards shown for `'ipv4'` / `'ipv6'` inputs

### Card skeletons
- Use **shadcn `Skeleton` component** with shimmer animation
- Each card shows **4–5 grey shimmer bars** that approximate the shape of the card's real data layout
- Skeleton is rendered when `CardState.status === 'loading'`

### Card error state
- Rendered when `CardState.status === 'error'`
- Layout: warning icon (e.g. `AlertCircle` from lucide-react) + `CardState.error` text
- **No retry button** — user re-fires by submitting the search bar again
- All error codes (`PRIVATE_IP`, `UPSTREAM_ERROR`, `INVALID_INPUT`) display identically — just show `ApiError.error.message`

### GeoCard fields
- Show **all 9 fields**: country, city, region, ISP, org, AS/ASN, timezone, lat, lon
- Layout: label/value rows (e.g. `<dt>Country</dt><dd>United States</dd>`)

### DnsCard display
- **Hide empty record types** — only render a section if the type has ≥1 record
- Each non-empty type gets a section header (e.g. "A Records")
- Records displayed as **table rows**: `| data | TTL |` per record

### WHOIS card
- Show: registrar, creation date, expiry date, nameservers, EPP status codes
- EPP codes shown **as-is** (raw strings, e.g. `clientTransferProhibited`) — no translation in Phase 2

### Claude's Discretion
- Exact skeleton bar heights and widths per card
- Exact shadcn component choices within cards (Card, CardHeader, CardContent, etc.)
- Icon choice for error state (AlertCircle or similar from lucide-react)
- Typography scale for field labels vs values inside cards
- Exact Tailwind classes for spacing, colors, borders

</decisions>

<specifics>
## Specific Ideas

- No specific visual references given — standard shadcn/ui component styling is the target
- The 2×2 grid collapses to single column on mobile (UI-01); grid CSS is `grid-cols-1 md:grid-cols-2`

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### API contracts (response shapes for card types)
- `src/app/api/geo/route.ts` — Returns flat ip-api.com fields: `country, countryCode, region, regionName, city, zip, lat, lon, timezone, isp, org, as, query`
- `src/app/api/dns/route.ts` — Returns `{ records: { A, AAAA, MX, TXT, NS, CNAME } }` where each value is `Array<{ name, data, TTL }>`
- `src/app/api/rdns/route.ts` — Returns PTR hostname string(s)
- `src/app/api/whois/route.ts` — Returns registrar, creation date, expiry date, nameservers, EPP status

### Shared utilities
- `src/lib/detect-input-type.ts` — `detectInputType`, `sanitizeInput`, `isPrivateIp` (all exported)
- `src/lib/api-error.ts` — `ApiError` type: `{ error: { code, message, upstreamStatus? } }`

### Layout shell
- `src/app/layout.tsx` — `ThemeProvider` wraps all children; Geist Sans + Geist Mono loaded; `suppressHydrationWarning` on `<html>`
- `src/app/page.tsx` — Currently a bare Server Component placeholder; `LookupDashboard` mounts here

### UI toolkit
- `src/components/ui/button.tsx` — shadcn Button (already installed)
- shadcn v4 base-nova preset, CSS variables — install additional components via `npx shadcn@latest add <component>`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `detectInputType(input)`: call with raw search bar value — returns `'ipv4' | 'ipv6' | 'domain' | 'unknown'`; also sanitizes input internally via `sanitizeInput`
- `isPrivateIp(ip)`: used in API routes; hook doesn't need to call it (API handles it)
- `ApiError` type: import for typing error states in `CardState<T>`
- `Button` component: use for Search button (supports `disabled`, accepts children)
- `ThemeProvider`: already wired in layout — dark mode works out of the box

### Established Patterns
- API routes return `Response.json(data)` on success or `Response.json({ error: {...} })` on failure
- All route errors follow `ApiError` shape — `error.message` is always human-readable
- `Promise.allSettled` already used inside `/api/dns/route.ts` for parallel record type fetches — replicate this pattern at hook level for the 4 cards

### Integration Points
- `page.tsx` (Server Component) renders `<LookupDashboard />` as its only child
- `LookupDashboard` must have `'use client'` directive — it owns all interactive state
- Hook lives in `src/hooks/use-lookup.ts`; cards in `src/components/` (e.g. `geo-card.tsx`)

</code_context>

<deferred>
## Deferred Ideas

- Retry button per card — Phase 3 or backlog
- URL `?q=` param sync — Phase 3 (SRCH-03)
- Auto-populate "My IP" on load — Phase 3 (SRCH-04)
- Dark/light mode toggle UI — Phase 3 (UI-02)
- Copy-to-clipboard on record values — Phase 3 (UI-03)
- TXT record highlighting (SPF/DKIM/DMARC) — v2 (ENH-01)
- EPP code plain-English translation — v2 (ENH-02)

</deferred>

---

*Phase: 02-core-ui*
*Context gathered: 2026-03-22*
