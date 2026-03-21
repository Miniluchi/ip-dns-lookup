# IP & DNS Lookup Dashboard

## What This Is

A personal web dashboard for quickly inspecting IPs and domains. You type any IP address or domain name into a single search bar, it auto-detects the input type, and displays all relevant data — geolocation, DNS records, reverse DNS, and WHOIS — in a clean 2×2 card grid. Built with Next.js and shadcn/ui.

## Core Value

Any IP or domain resolved in one search, with all lookup types shown simultaneously in a modern, scannable layout.

## Requirements

### Validated

- [x] Single search bar that auto-detects IP vs. domain input — Validated in Phase 01: Foundation
- [x] Geolocation card — country, city, region, ASN, ISP (via ip-api.com) — Validated in Phase 01: Foundation
- [x] DNS records card — A, AAAA, MX, TXT, NS, CNAME records (via dns.google) — Validated in Phase 01: Foundation
- [x] Reverse DNS card — PTR lookup from IP to hostname — Validated in Phase 01: Foundation
- [x] WHOIS card — registrar, registration/expiry dates, status (via RDAP) — Validated in Phase 01: Foundation

### Active

- [ ] 2×2 card grid layout, all cards load in parallel
- [ ] Loading skeletons while queries are in flight
- [ ] Error states per card (one failing API doesn't break others)
- [ ] Modern dark/light UI using shadcn/ui components

### Out of Scope

- Authentication — personal tool, no login needed
- History / saved lookups — v2 if desired
- Rate limiting / abuse protection — personal use only
- Mobile app — web only

## Context

- Stack: Next.js (App Router), shadcn/ui, Tailwind CSS
- APIs: ip-api.com (geolocation, free tier), dns.google (DNS over HTTPS, no key), RDAP (WHOIS, IANA standard, no key)
- No API keys required — fully deployable without configuration
- Personal tool — no multi-user concerns, no auth layer

## Constraints

- **Tech stack**: Next.js + shadcn/ui — chosen by user
- **APIs**: Free-tier only, no API keys — zero-config deployment
- **Deployment**: Should work on Vercel out of the box

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Free APIs only | Zero-config, no credentials to manage | — Pending |
| Single search bar (auto-detect) | Faster UX — no need to know lookup type upfront | — Pending |
| Parallel card loading | One slow API shouldn't block the rest | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-22 — Phase 01 complete (scaffold + utilities TDD + API routes)*
