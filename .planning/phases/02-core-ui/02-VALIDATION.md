---
phase: 2
slug: core-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x / @testing-library/react |
| **Config file** | `jest.config.js` (may need Wave 0 install) |
| **Quick run command** | `npm test -- --passWithNoTests` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --passWithNoTests`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 02-01 | 1 | SRCH-01, SRCH-02, CARD-01 | unit | `npm test -- useLookup` | ❌ W0 | ⬜ pending |
| 2-01-02 | 02-01 | 1 | CARD-02, CARD-03 | unit | `npm test -- useLookup` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02-02 | 2 | UI-01, SRCH-01 | manual | browser test | n/a | ⬜ pending |
| 2-02-02 | 02-02 | 2 | CARD-04, CARD-07 | manual | browser test | n/a | ⬜ pending |
| 2-03-01 | 02-03 | 2 | CARD-05, CARD-06 | manual | browser test | n/a | ⬜ pending |
| 2-03-02 | 02-03 | 2 | UI-04 | manual | browser test | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/hooks/__tests__/useLookup.test.ts` — stubs for SRCH-01, SRCH-02, CARD-01, CARD-02, CARD-03
- [ ] `jest.config.js` — if not present; configure for Next.js + TypeScript
- [ ] `npm install --save-dev jest @testing-library/react @testing-library/jest-dom` — if not already installed

*Verify with `npx shadcn@latest add skeleton card` before Wave 1 component work.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 4 cards load simultaneously on search | CARD-04 | Requires real browser + network | Type `8.8.8.8`, press Enter, observe all 4 cards load |
| Skeleton shown independently per card | CARD-07 | Visual rendering requires browser | Throttle network, verify each card shows skeleton independently |
| Domain hides Reverse DNS card | SRCH-02 | Conditional render requires DOM | Search `google.com`, verify rDNS card hidden |
| Error isolation on route kill | CARD-05 | Requires API route modification | Comment out `/api/whois`, verify only WHOIS card errors |
| 2-column grid layout | UI-01 | Visual layout check | Verify 2×2 grid at desktop breakpoint |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
