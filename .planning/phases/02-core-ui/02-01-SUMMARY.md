---
phase: 02-core-ui
plan: 01
subsystem: ui
tags: [react, hooks, typescript, shadcn, vitest, fetch, promise-allsettled]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: detect-input-type.ts (sanitizeInput, detectInputType), api-error.ts (ApiError type), /api/geo, /api/dns, /api/rdns, /api/whois route handlers
provides:
  - CardState<T> generic type for all card components
  - GeoData, DnsData, RdnsData, WhoisData, LookupState, InputType types
  - useLookup React hook with parallel API orchestration
  - performLookup pure async function for testability
  - shadcn Skeleton component
  - shadcn Card, CardHeader, CardTitle, CardContent, CardFooter, CardAction, CardDescription components
affects: [02-core-ui plan 02 (GeoCard), plan 03 (card components), dashboard layout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CardState<T> generic: { status: idle|loading|success|error, data: T|null, error: string|null } — drives all card rendering logic"
    - "performLookup extracted as pure async function: testable without React jsdom, hook wraps it with useState"
    - "Promise.allSettled: all 4 fetches fire independently, one failure does not block others"
    - "rdns stays idle for domain input — detected by isIp flag before constructing the allSettled array"

key-files:
  created:
    - src/hooks/use-lookup.ts
    - src/hooks/use-lookup.test.ts
    - src/components/ui/skeleton.tsx
    - src/components/ui/card.tsx
  modified: []

key-decisions:
  - "performLookup exported as pure async function: vitest environment is node (no jsdom), so hook state cannot be tested with renderHook; extracting pure logic enables full unit test coverage without adding testing-library/react"
  - "fetchCard checks both !res.ok AND json.error: defensive against API routes that return 200 with error body shape"
  - "rdns card uses idleCard() (not loadingCard) when input is domain: matches must_haves truth that domain input sets rdns to idle"

patterns-established:
  - "CardState<T>: all card components must accept CardState<T> as a prop and render based on .status"
  - "useLookup returns: { state, inputType, isLoading, lookup } — standard interface for LookupDashboard"

requirements-completed: [SRCH-01, SRCH-02, CARD-05, CARD-06, CARD-07]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 02 Plan 01: useLookup Hook and shadcn Components Summary

**`useLookup` hook with `Promise.allSettled` orchestrating 4 parallel API calls, full TypeScript data types, and shadcn Skeleton/Card UI components — the dependency bottleneck for all downstream card work**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-22T11:34:43Z
- **Completed:** 2026-03-22T11:36:50Z
- **Tasks:** 2 (plus TDD RED commit)
- **Files modified:** 4 created

## Accomplishments

- Installed shadcn Skeleton and Card components (base-nova preset, no modifications)
- Defined all TypeScript data types: `CardState<T>`, `GeoData`, `DnsData`, `RdnsData`, `WhoisData`, `LookupState`, `InputType`
- Implemented `performLookup` pure async function with `Promise.allSettled` — rdns skipped for domain input
- Implemented `useLookup` React hook wrapping `performLookup` with `useState` + loading state
- 6 unit tests written and passing (empty/invalid validation, IP fires 4 calls, domain fires 3 calls, error isolation, API error body handling)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn skeleton and card components** - `42d3b933` (feat)
2. **Task 2 RED: Failing tests for useLookup hook** - `7dccf034` (test)
3. **Task 2 GREEN: Implement useLookup hook** - `bc9161d4` (feat)

_TDD task has test commit (RED) followed by implementation commit (GREEN)._

## Files Created/Modified

- `src/components/ui/skeleton.tsx` - shadcn Skeleton component with animate-pulse shimmer
- `src/components/ui/card.tsx` - shadcn Card, CardHeader, CardTitle, CardContent, CardFooter, CardAction, CardDescription
- `src/hooks/use-lookup.ts` - All exported types + performLookup + useLookup hook
- `src/hooks/use-lookup.test.ts` - 6 unit tests covering validation, parallel fetch behavior, error isolation

## Decisions Made

- **performLookup as pure export:** Avoids needing `@testing-library/react` + jsdom for unit tests since vitest environment is `node`. The hook wraps this function with `useState`. Downstream testing of card components may need jsdom but hook logic is fully testable.
- **fetchCard error handling:** Checks `!res.ok` first, then `json?.error?.message` to extract human-readable error strings from the API error schema.
- **rdns idle vs loading for domain:** The `isIp` flag is computed before constructing the `Promise.allSettled` array — for domains, rdns slot receives `Promise.resolve(idleCard())` which resolves immediately.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 data types exported and ready for card components to import
- `useLookup` hook ready for `LookupDashboard` to consume
- `CardState<T>` type establishes the standard prop shape for all 4 card components
- shadcn Skeleton ready for loading state rendering inside card components
- shadcn Card components ready for card layout

## Self-Check: PASSED

- src/hooks/use-lookup.ts: FOUND
- src/hooks/use-lookup.test.ts: FOUND
- src/components/ui/skeleton.tsx: FOUND
- src/components/ui/card.tsx: FOUND
- .planning/phases/02-core-ui/02-01-SUMMARY.md: FOUND
- Commit 42d3b933 (shadcn components): FOUND
- Commit 7dccf034 (TDD RED tests): FOUND
- Commit bc9161d4 (hook implementation): FOUND

---
*Phase: 02-core-ui*
*Completed: 2026-03-22*
