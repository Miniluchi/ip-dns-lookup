---
phase: 02-core-ui
plan: 04
subsystem: ui
tags: [vitest, fetch, use-lookup, tdd, bug-fix]

# Dependency graph
requires:
  - phase: 02-core-ui-01
    provides: performLookup hook with fetch URL construction
  - phase: 02-core-ui-02
    provides: card components consuming hook state
  - phase: 02-core-ui-03
    provides: LookupDashboard wiring hook to UI
provides:
  - Correct ?q= fetch URLs in performLookup (all 4 endpoints)
  - Unit test asserting URL parameter contract against regression
affects: [02-core-ui-verification, any future modification of use-lookup.ts]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/hooks/use-lookup.ts
    - src/hooks/use-lookup.test.ts

key-decisions:
  - "TDD RED/GREEN: test written first against buggy code, then fix applied — prevents silent regression"

patterns-established: []

requirements-completed:
  - SRCH-01
  - SRCH-02
  - CARD-01
  - CARD-02
  - CARD-03
  - CARD-04
  - CARD-05
  - CARD-06
  - CARD-07
  - UI-01
  - UI-04

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 2 Plan 4: Gap Closure — ?query= to ?q= Fix Summary

**Fixed single-character query param mismatch (?query= to ?q=) that caused all 4 API lookups to return 422 INVALID_INPUT, with a regression-preventing TDD contract test**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T13:02:00Z
- **Completed:** 2026-03-22T13:02:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added Test 7 asserting fetch URLs use `?q=` parameter (RED phase, confirmed failure)
- Fixed all 4 fetch URL calls in performLookup from `?query=` to `?q=`
- All 53 tests pass across the entire test suite (GREEN)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add unit test asserting fetch URLs use ?q= parameter** - `a7d04e89` (test)
2. **Task 2: Fix ?query= to ?q= in all 4 fetch URLs and verify GREEN** - `93462ded` (feat)

_Note: TDD tasks have two commits — test (RED) then fix (GREEN)_

## Files Created/Modified

- `src/hooks/use-lookup.ts` - Replaced `?query=` with `?q=` on lines 107, 108, 110, 112
- `src/hooks/use-lookup.test.ts` - Added Test 7: URL parameter contract assertion

## Decisions Made

- TDD RED/GREEN cycle enforced: test written and confirmed failing before applying fix — ensures the test genuinely catches the bug rather than being written after the fact

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — the fix was a straightforward string replacement of 4 occurrences.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All API lookups now reach their routes with the correct `?q=` parameter
- Live data should flow into all 4 cards on the dashboard
- Phase 02 verification can proceed

---
*Phase: 02-core-ui*
*Completed: 2026-03-22*
