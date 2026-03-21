# Roadmap: IP & DNS Lookup Dashboard

## Overview

Three phases take the project from zero to a polished, deployable tool. Phase 1 builds the proxy infrastructure that all card data flows through — nothing renders without it. Phase 2 wires the client orchestration and card components, producing a fully functional product. Phase 3 adds the UX details that make it genuinely pleasant to use daily: shareable URLs, auto-populated "My IP", copy buttons, and dark mode.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Scaffold the project and build all 4 API route handlers with input detection utilities
- [ ] **Phase 2: Core UI** - Build the useLookup hook, search bar, and all 4 card components to produce a working product
- [ ] **Phase 3: Polish** - Add URL state, "My IP" auto-load, copy-to-clipboard, dark mode, and responsive layout

## Phase Details

### Phase 1: Foundation
**Goal**: A working Next.js project with all 4 proxy route handlers verified against live APIs and input detection utilities in place.
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08
**Success Criteria** (what must be TRUE):
  1. `curl http://localhost:3000/api/geo?q=8.8.8.8` returns JSON with country, city, ISP, ASN fields
  2. `curl http://localhost:3000/api/dns?q=example.com` returns A, AAAA, MX, TXT, NS, CNAME record arrays
  3. `curl http://localhost:3000/api/rdns?q=8.8.8.8` returns a PTR hostname string
  4. `curl http://localhost:3000/api/whois?q=example.com` returns registrar, creation date, expiry date fields
  5. `detectInputType('192.168.1.1')` returns `'ipv4'`, a domain returns `'domain'`, and `'https://example.com/path'` is sanitized to `'example.com'` before classification
**Plans:** 1/3 plans executed

Plans:
- [x] 01-01: Scaffold Next.js 15 project with TypeScript, Tailwind CSS v4, shadcn/ui (New York), and next-themes
- [ ] 01-02: Implement `detectInputType` utility and input sanitization; add private/reserved IP short-circuit logic
- [ ] 01-03: Build all 4 API route handlers (`/api/geo`, `/api/dns`, `/api/rdns`, `/api/whois`) with normalized error shapes

### Phase 2: Core UI
**Goal**: A fully functional single-page lookup — search fires 4 parallel requests, each card independently shows skeleton, error, or data.
**Depends on**: Phase 1
**Requirements**: SRCH-01, SRCH-02, CARD-01, CARD-02, CARD-03, CARD-04, CARD-05, CARD-06, CARD-07, UI-01, UI-04
**Success Criteria** (what must be TRUE):
  1. Typing `8.8.8.8` and pressing Enter populates all 4 cards with live data simultaneously
  2. Each card displays a loading skeleton independently while its API call is in flight
  3. Killing one API route (e.g., commenting out `/api/whois`) causes only the WHOIS card to show an error; the other 3 cards still load correctly
  4. Searching a domain hides the Reverse DNS card; searching an IP hides no geo/rdns cards
  5. The 2-column card grid renders correctly and all card data is readable with shadcn/ui styling
**Plans:** TBD

Plans:
- [ ] 02-01: Build `useLookup` hook — `Promise.allSettled` orchestration, `CardState<T>` per card, `detectInputType` integration
- [ ] 02-02: Build `LookupDashboard` client component with search bar and 2×2 card grid wiring
- [ ] 02-03: Build `GeoCard`, `DnsCard`, `ReverseDnsCard`, `WhoisCard` — each renders skeleton / error / data from `CardState<T>` prop

### Phase 3: Polish
**Goal**: The tool is bookmarkable, starts with your own IP pre-loaded, supports copy-to-clipboard, and looks great in dark and light mode.
**Depends on**: Phase 2
**Requirements**: SRCH-03, SRCH-04, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. Loading `/?q=8.8.8.8` in a fresh browser tab automatically fires all 4 lookups for `8.8.8.8`
  2. On initial page load with no `?q=` param, the dashboard auto-populates and searches the visitor's own public IP
  3. Clicking the copy icon on any record value writes it to the clipboard
  4. The dark/light mode toggle switches the theme without a flash of unstyled content on page load
**Plans:** TBD

Plans:
- [ ] 03-01: Implement `?q=` URL param — read on mount to auto-trigger lookup; update on each search
- [ ] 03-02: Add "My IP" auto-load on initial mount (no `?q=` param); add copy-to-clipboard to card record values; integrate dark/light toggle

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/3 | In Progress|  |
| 2. Core UI | 0/3 | Not started | - |
| 3. Polish | 0/2 | Not started | - |

---
*Roadmap created: 2026-03-21*
*Granularity: COARSE — 3 phases, 8 plans total*
*Coverage: 23/23 v1 requirements mapped*
