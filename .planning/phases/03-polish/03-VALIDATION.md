---
phase: 3
slug: polish
status: draft
nyquist_compliant: true
wave_0_complete: true
unit_coverage_deferred: true
created: 2026-03-22
updated: 2026-03-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via next test or vitest directly) |
| **Config file** | none |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** `npx tsc --noEmit` clean + manual browser checks
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 03-01-01 | 01 | 1 | SRCH-03/04 | curl + manual | `curl -s localhost:3000/api/geo \| jq .query` | pending |
| 03-01-02 | 01 | 1 | SRCH-03/04, UI-02 | tsc + manual | `npx tsc --noEmit` | pending |
| 03-02-01 | 02 | 1 | UI-03 | tsc + manual | `npx tsc --noEmit` | pending |
| 03-02-02 | 02 | 1 | UI-03 | tsc + manual | `npx tsc --noEmit` | pending |

*Status: pending / green / red / flaky*

---

## Unit Test Coverage — Deliberately Deferred

Phase 3 is a polish phase adding UI interactions (URL params, clipboard, theme toggle) that are
best verified through TypeScript compilation and manual browser testing. Writing unit tests for
these behaviors would require jsdom/browser mocking of `useSearchParams`, `useRouter`,
`navigator.clipboard`, and `useTheme` — overhead disproportionate to the risk for a personal tool.

**What is NOT covered by unit tests (deliberate decision):**
- SRCH-03: URL `?q=` param read/write (verified manually + `tsc --noEmit`)
- SRCH-04: My IP auto-load on mount (verified manually + `tsc --noEmit`)
- UI-03: Copy-to-clipboard behavior (verified manually + `tsc --noEmit`)

**What IS verified:**
- TypeScript compilation catches type errors, missing imports, wrong API shapes
- Manual browser checks confirm runtime behavior (URL updates, clipboard writes, theme switches)
- Existing tests from prior phases (`src/hooks/use-lookup.test.ts`, `src/lib/detect-input-type.test.ts`) continue to pass and cover core logic

**Previously listed Wave 0 test files are no longer planned:**
- ~~src/app/api/geo/route.test.ts~~
- ~~src/components/copy-button.test.ts~~
- ~~src/components/lookup-dashboard.test.ts~~

These may be added in a future testing phase if the project grows beyond personal-tool scope.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/?q=8.8.8.8` auto-fires lookups on fresh tab load | SRCH-03 | Requires browser navigation + network | Open `/?q=8.8.8.8` in incognito; verify all 4 cards populate |
| Initial load auto-detects visitor IP | SRCH-04 | Requires real public IP detection | Load `/` with no params; verify cards show your public IP |
| Dark/light toggle — no FOUC on page load | UI-02 | Requires visual inspection | Reload page in dark mode; verify no flash of unstyled content |
| Copy icon appears on hover, copies to clipboard | UI-03 | Requires hover + clipboard access | Hover over a GeoCard value; click copy icon; paste in another app |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (tsc --noEmit)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Unit test coverage explicitly deferred (documented above)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready (unit coverage deferred by design)
