# Requirements: IP & DNS Lookup Dashboard

**Defined:** 2026-03-21
**Core Value:** Any IP or domain resolved in one search, with all lookup types shown simultaneously in a modern, scannable layout.

## v1 Requirements

### Foundation

- [x] **FOUND-01**: Project scaffolded with Next.js 14+ App Router, TypeScript, Tailwind CSS, and shadcn/ui
- [x] **FOUND-02**: `detectInputType(input)` utility correctly identifies IPv4, IPv6, and domain inputs
- [x] **FOUND-03**: Input sanitization strips `https?://` prefixes and trailing paths before querying
- [ ] **FOUND-04**: `GET /api/geo?q={ip}` route handler proxies ip-api.com and returns geolocation data
- [ ] **FOUND-05**: `GET /api/dns?q={domain}` route handler proxies dns.google for A, AAAA, MX, TXT, NS, CNAME records
- [ ] **FOUND-06**: `GET /api/rdns?q={ip}` route handler performs PTR lookup via dns.google
- [ ] **FOUND-07**: `GET /api/whois?q={input}` route handler queries RDAP and returns registration data
- [x] **FOUND-08**: Private/reserved IP ranges are detected and short-circuited before API calls

### Search

- [ ] **SRCH-01**: Single search bar accepts any IP address or domain name
- [ ] **SRCH-02**: Pressing Enter or clicking Search fires all 4 lookups in parallel via `Promise.allSettled`
- [ ] **SRCH-03**: URL `?q=` param is set on search, enabling shareable/bookmarkable lookups
- [ ] **SRCH-04**: Page loads with user's own IP pre-populated (via ip-api.com no-arg call)

### Cards

- [ ] **CARD-01**: Geolocation card displays country, city, region, ISP, org, ASN, timezone, lat/lon
- [ ] **CARD-02**: DNS Records card displays all record types in grouped, readable format
- [ ] **CARD-03**: Reverse DNS card displays PTR hostname(s) for IP inputs
- [ ] **CARD-04**: WHOIS card displays registrar, creation date, expiry date, nameservers, EPP status
- [ ] **CARD-05**: Each card shows a loading skeleton while its API call is in flight
- [ ] **CARD-06**: Each card shows an inline error state if its API call fails (other cards unaffected)
- [ ] **CARD-07**: Cards irrelevant to input type are hidden (e.g. Reverse DNS hidden for domain input)

### UI & UX

- [ ] **UI-01**: 2×2 card grid layout on desktop, single column on mobile
- [ ] **UI-02**: Dark/light mode toggle using next-themes
- [ ] **UI-03**: Copy-to-clipboard button on individual record values
- [ ] **UI-04**: Modern shadcn/ui visual design — no default/unstyled components

## v2 Requirements

### History

- **HIST-01**: Recent lookups stored in localStorage and displayed below search bar
- **HIST-02**: Click a history entry to re-run that lookup

### Enhancements

- **ENH-01**: TXT record parsing — SPF, DKIM, DMARC highlighted with labels
- **ENH-02**: EPP status codes translated to plain-English descriptions
- **ENH-03**: Domain expiry countdown ("expires in 47 days") with color coding
- **ENH-04**: Map embed showing geolocation lat/lon pin

## Out of Scope

| Feature | Reason |
|---------|--------|
| Authentication | Personal tool — no users |
| Rate limiting / abuse protection | Personal use only |
| Backend database / persistence | Stateless by design |
| Mobile app | Web-first |
| OAuth / social login | Not needed |
| Paid API keys | Free tier sufficient for personal use |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| FOUND-06 | Phase 1 | Pending |
| FOUND-07 | Phase 1 | Pending |
| FOUND-08 | Phase 1 | Complete |
| SRCH-01 | Phase 2 | Pending |
| SRCH-02 | Phase 2 | Pending |
| SRCH-03 | Phase 3 | Pending |
| SRCH-04 | Phase 3 | Pending |
| CARD-01 | Phase 2 | Pending |
| CARD-02 | Phase 2 | Pending |
| CARD-03 | Phase 2 | Pending |
| CARD-04 | Phase 2 | Pending |
| CARD-05 | Phase 2 | Pending |
| CARD-06 | Phase 2 | Pending |
| CARD-07 | Phase 2 | Pending |
| UI-01 | Phase 2 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 — traceability corrected after roadmap: SRCH-03, SRCH-04, UI-02 moved to Phase 3 (polish layer)*
