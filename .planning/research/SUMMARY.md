# Project Research Summary

**Project:** Personal IP & DNS Lookup Dashboard
**Domain:** Developer tool — on-demand network intelligence (IP geolocation, DNS, RDAP, reverse DNS)
**Researched:** 2026-03-21
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a client-interactive single-page lookup tool, not a data-driven dashboard. The critical architectural insight is that the search fires after page load, in response to user input — which makes Server Component data fetching the wrong model. The correct pattern is a thin server shell (`app/page.tsx`) wrapping a single `'use client'` subtree (`LookupDashboard`) that owns all state, fires 4 parallel fetches via `Promise.allSettled`, and distributes per-card `{ data, loading, error }` state to independent card components. The page never navigates; results update in place.

The recommended approach uses Next.js 15+ App Router with four thin Next.js API route handlers (`/api/geo`, `/api/dns`, `/api/rdns`, `/api/whois`) acting as proxies to free external APIs. Proxying is mandatory — not optional — because ip-api.com free tier is HTTP-only, which is blocked as mixed content from any HTTPS page. The proxy layer also normalizes error shapes, making each card's error handling uniform regardless of which upstream API failed. All four free APIs (ip-api.com, dns.google, rdap.org) require no authentication and have generous enough rate limits for personal use.

The primary risks are: (1) ip-api.com's HTTP-only constraint being missed, causing silent failures in production; (2) using `Promise.all` instead of `Promise.allSettled`, which causes a single RDAP 404 to blank all four cards; (3) calling ip-api.com directly from the browser instead of through the proxy. Input validation needs to strip protocol prefixes (users paste `https://example.com`), handle private/reserved IP ranges gracefully before hitting the API, and correctly construct `in-addr.arpa` / `ip6.arpa` reverse-lookup names from IP input.

---

## Key Findings

### Recommended Stack

Bootstrap with `create-next-app@latest --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`, then `npx shadcn@latest init` (New York style, CSS variables). The project needs no external data-fetching library — native `fetch` + `Promise.allSettled` in a custom hook covers the entire fetching model. `next-themes` is the only required add-on beyond the scaffold, for dark mode without FOUC. Node.js 20.9+ is required.

**Core technologies:**
- **Next.js 15+ (App Router):** Full-stack framework — route handlers as API proxies, TypeScript support, streaming via Suspense if needed
- **TypeScript 5.x:** Strict mode; `params`/`searchParams` are `Promise` types in Next.js 15+ (must `await` them in route handlers)
- **Tailwind CSS v4:** Utility-first CSS; dark mode via `@custom-variant dark`
- **shadcn/ui (New York):** Copies editable `Card`, `Skeleton`, `Badge`, `Input`, `Button` components into `src/components/ui/`
- **next-themes:** ThemeProvider wrapping root layout; `suppressHydrationWarning` on `<html>` is required to prevent hydration mismatch

**Key version note:** In Next.js 15+, dynamic segment `params` in route handlers are a `Promise` — use `request.nextUrl.searchParams` for query params (no await needed), but `await params` for path segments.

### Expected Features

**Must have (table stakes):**
- Single search bar with auto-detection (IPv4 / IPv6 / domain) — regex classify before routing
- IP geolocation card: country, city, ISP, ASN, timezone (ip-api.com free JSON endpoint)
- DNS records card: A, AAAA, MX, TXT, NS, CNAME in parallel (dns.google DoH)
- Reverse DNS (PTR) card: auto-constructs `in-addr.arpa` / `ip6.arpa` query from IP input
- WHOIS/RDAP card: registration date, expiry, registrar, nameservers, EPP status (rdap.org bootstrap)
- Copy-to-clipboard on all values
- Shareable URL via `?q=` query param
- Human-readable error states for all failure modes (NXDOMAIN, private IP, rate limit, RDAP 404)
- Mobile-responsive 2-column card grid

**Should have (differentiators):**
- "My IP" button (calls ip-api.com with no query param)
- Lookup history in localStorage (last 10 queries)
- Dark mode toggle
- TXT record labeling (SPF / DKIM / DMARC auto-detected by prefix)
- MX records sorted by priority (lowest = highest preference)
- Days-until-expiry for RDAP expiration date
- EPP status codes translated to plain English
- ASN parsed from ip-api `as` field via `^(AS\d+)\s+(.+)$`
- Strip protocol/path from pasted URLs before querying

**Defer to v2+:**
- Map/geolocation pin (Leaflet adds ~40KB; good differentiator but not essential)
- CNAME chain visualizer
- Proxy/VPN/hosting detection (requires ip-api.com pro)
- ASN/autnum RDAP lookup
- CAA / SRV record types
- DNSSEC validation deep-dive
- Bulk CSV lookup

### Architecture Approach

The architecture is a hybrid: a Server Component page shell renders a single `'use client'` root (`LookupDashboard`) which holds all state. `LookupDashboard` contains a `useLookup` hook that fires `Promise.allSettled` against four Next.js route handlers simultaneously on submit. Each route handler proxies one external API, normalizes the response to a consistent `{ data } | { error }` shape, and returns. The four card components (`GeoCard`, `DnsCard`, `ReverseDnsCard`, `WhoisCard`) each receive a `CardState<T>` prop from the hook and independently render loading skeleton / error message / data. Do not use `<Suspense>` for skeleton display — this is client-triggered fetching; `state.loading` conditional rendering is the correct pattern here.

**Major components:**
1. `app/page.tsx` (Server) — static shell; renders `<LookupDashboard />`
2. `components/LookupDashboard.tsx` (Client) — `'use client'` root; owns `useLookup` state, renders search bar + card grid
3. `hooks/use-lookup.ts` (Client hook) — `Promise.allSettled` orchestration; `detectInputType`; per-card `CardState<T>`
4. `lib/detect-input-type.ts` (Shared) — pure regex classifier: `'ipv4' | 'ipv6' | 'domain' | 'unknown'`
5. `app/api/geo/route.ts` (Route Handler) — proxies `http://ip-api.com/json/{query}?fields=...`
6. `app/api/dns/route.ts` (Route Handler) — proxies dns.google for A/AAAA/MX/TXT/NS/CNAME in parallel via `Promise.allSettled`
7. `app/api/rdns/route.ts` (Route Handler) — proxies dns.google PTR query; constructs `in-addr.arpa`/`ip6.arpa` name server-side
8. `app/api/whois/route.ts` (Route Handler) — proxies `rdap.org/domain/{d}` or `rdap.arin.net/registry/ip/{ip}` based on input type
9. `components/*Card.tsx` (Client) — receive `CardState<T>`; render loading / error / data
10. `components/CardErrorBoundary.tsx` (Client) — React error boundary per card for unexpected render crashes

### Critical Pitfalls

1. **ip-api.com is HTTP-only on free tier** — direct browser fetch is blocked as mixed content on HTTPS pages. Always call it server-side through `/api/geo`. No workaround exists on the free tier.

2. **`Promise.all` vs `Promise.allSettled`** — use `Promise.allSettled` at both layers: in `useLookup` (client) and in `/api/dns/route.ts` (server-side per record type). A single RDAP 404 or missing MX record must not reject everything else.

3. **Missing `Answer` array in DNS responses** — dns.google returns `Status: 3` (NXDOMAIN) with no `Answer` key when a record type doesn't exist. Always guard with `data.Answer ?? []` before mapping.

4. **Private/reserved IP short-circuit** — ip-api.com returns `{ status: "fail", message: "private range" }` for RFC 1918 addresses. Detect these client-side (or in the route handler) and return a friendly message rather than forwarding to the API.

5. **Input includes protocol/path** — users frequently paste `https://example.com/path`. Strip `https?://` and any trailing path before classifying and querying. Do this in `detectInputType` or as a pre-processing step in the search handler.

6. **RDAP response structure varies by registry** — `entities`, `events`, `status` arrays may be absent, empty, or nested differently across registries. Parse defensively with optional chaining; never assume fields are present.

7. **Vercel hobby tier 10s function timeout** — RDAP can be slow for some registries. Monitor `/api/whois` response times; if consistently slow, consider a 8s client-side timeout with `AbortController`.

---

## Implications for Roadmap

Based on research, the project has clear dependency ordering: the proxy infrastructure must exist before any card can render data, and the shared hook + input detection must exist before cards can be wired together. Three phases cover the full MVP cleanly.

### Phase 1: Foundation — Scaffold, Proxy Layer, and Input Detection

**Rationale:** The API route handlers are the load-bearing infrastructure. Nothing renders useful data without them. Building them first also validates all four external APIs are reachable and returning expected shapes before any UI exists.

**Delivers:** Working Next.js project with all 4 route handlers (`/api/geo`, `/api/dns`, `/api/rdns`, `/api/whois`) verified via browser/curl; `detectInputType` utility; dark mode setup; project structure in place.

**Addresses:** ip-api.com HTTP proxy requirement (mandatory), RDAP routing (domain vs IP detection), DNS parallel record fetching per route handler.

**Avoids:** Mixed-content pitfall (ip-api.com HTTP), RDAP CORS variability.

**Research flag:** Skip — all patterns are well-documented. Route handler structure is standard Next.js; API schemas are stable.

### Phase 2: Core UI — LookupDashboard, Cards, and useLookup Hook

**Rationale:** With proxy routes working, wire the client-side orchestration. Build the `useLookup` hook and four card components. This is the highest-value phase — it produces the visible, usable product.

**Delivers:** Functional single-page lookup: search bar triggers parallel fetch to all 4 routes; each card independently shows skeleton during load, error on failure, or data on success. Copy-to-clipboard on all values. Basic responsive grid layout.

**Addresses:** Table-stakes features (geolocation, DNS records, PTR, RDAP), `Promise.allSettled` pattern, per-card error states, skeleton loading.

**Avoids:** `Promise.all` mistake, per-card `useEffect` anti-pattern, Server Component data fetching for interactive queries.

**Research flag:** Skip — patterns are well-documented. `useLookup` hook structure is explicit in ARCHITECTURE.md.

### Phase 3: Polish — UX Differentiators and URL State

**Rationale:** The core tool is usable after Phase 2. Phase 3 adds the features that make it genuinely pleasant: shareable URLs, history, "My IP", TXT parsing, EPP translation, expiry countdown.

**Delivers:** `?q=` URL param (bookmarkable results); localStorage history (last 10 queries); "My IP" button; TXT record SPF/DKIM/DMARC labeling; MX priority sort; EPP status plain-English; days-until-expiry warning; protocol/path stripping from pasted input; private IP friendly messages.

**Addresses:** Differentiator features from FEATURES.md; input validation edge cases from PITFALLS.md.

**Avoids:** Over-engineering (no map library, no SWR/React Query, no auth complexity).

**Research flag:** Skip — all straightforward UI logic; no novel integrations.

### Phase Ordering Rationale

- Proxy layer before UI: cards cannot render without working routes; verifying API schemas early prevents late surprises
- All four cards in one phase: they share the same `useLookup` state model and are tightly coupled; splitting them across phases creates integration risk
- Polish last: URL params and history are independent features that don't block core functionality; adding them last keeps Phase 2 focused

### Research Flags

**Phases needing deeper research during planning:** None — all three phases use well-established patterns with official documentation and stable APIs.

**Phases with standard patterns (skip research-phase):**
- Phase 1: Next.js route handlers are well-documented; ip-api.com and dns.google schemas are stable
- Phase 2: `useLookup` hook pattern and shadcn/ui component usage are explicit and well-understood
- Phase 3: localStorage, URL search params, and string parsing are standard browser APIs

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Next.js 15+ docs fetched from official source (v16.2.1); shadcn/ui MEDIUM (site was blocked, patterns inferred from training data) |
| Features | MEDIUM | API schemas stable as of Aug 2025 cutoff; rate limits and exact field availability should be verified against live docs before implementation |
| Architecture | HIGH | Official Next.js docs confirm route handler patterns, async params, `cache: 'no-store'` behavior; `Promise.allSettled` is standard JS |
| Pitfalls | MEDIUM-HIGH | ip-api.com HTTP-only restriction is well-established; CORS headers for dns.google and RDAP not directly verified (WebFetch blocked) |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **ip-api.com CORS headers:** Not verified from official docs in this session. The HTTP-only constraint makes proxying mandatory regardless, but confirm CORS policy hasn't changed if considering direct calls for any reason.
- **shadcn/ui exact CLI behavior:** shadcn.com was inaccessible during research. Verify `npx shadcn@latest init` prompts and `npx shadcn@latest add` component names match documented behavior before running.
- **RDAP coverage for non-gTLD TLDs:** Older ccTLDs may not support RDAP. The `/api/whois` route handler should return a graceful "WHOIS not available via RDAP for this TLD" message rather than surfacing a raw HTTP error.
- **ip6.arpa reverse construction:** IPv6 PTR construction (expand, remove colons, reverse nibbles, insert dots) should be unit-tested before integrating — the transformation is error-prone.

---

## Sources

### Primary (HIGH confidence)
- Next.js official docs v16.2.1 (nextjs.org) — route handlers, data fetching, server/client components, caching, error handling
- Tailwind CSS docs (tailwindcss.com) — dark mode `@custom-variant` syntax for v4

### Secondary (MEDIUM confidence)
- ip-api.com docs (`https://ip-api.com/docs/api:json`) — field list, rate limits, error responses; not fetched live but stable/well-known schema
- Google DoH docs (`https://developers.google.com/speed/public-dns/docs/doh/json`) — response format, RCODE values; not fetched live
- RDAP specification RFC 9083 — response structure, `events`, `entities`, `status` fields
- rdap.org public bootstrap — domain/IP routing behavior; not fetched live

### Tertiary (LOW confidence)
- shadcn/ui installation and component API — inferred from training data; verify against `https://ui.shadcn.com/docs` before implementation
- RDAP CORS policy per registry — individual registry policies vary; proxying via `/api/whois` eliminates this uncertainty entirely

---

*Research completed: 2026-03-21*
*Ready for roadmap: yes*
