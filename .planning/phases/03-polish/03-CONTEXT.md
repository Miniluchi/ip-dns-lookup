# Phase 3: Polish - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Add URL state, "My IP" auto-load, copy-to-clipboard, and dark mode toggle. The tool becomes bookmarkable, starts pre-loaded with the visitor's own IP, and supports both light and dark themes. No new data, no new cards — polish only.

</domain>

<decisions>
## Implementation Decisions

### URL param (`?q=`)
- **D-01:** URL updates on **search submit only** — not on every keystroke
- **D-02:** Use `router.replace` (not `push`) — avoids polluting the back button history
- **D-03:** On mount, read `?q=` via `useSearchParams` and auto-trigger the lookup if a value is present
- **D-04:** The search bar input field is populated with the `?q=` value before the lookup fires

### "My IP" auto-load
- **D-05:** On initial mount **with no `?q=` param**: call `GET /api/geo` with no `q` argument — ip-api.com returns the visitor's own IP when called without a parameter
- **D-06:** On success: populate the search bar with the returned IP and immediately fire the full 4-card lookup
- **D-07:** On failure: silent fail — show empty search bar, user types manually. No error message shown.
- **D-08:** The `/api/geo` route must accept a missing `q` param and forward the bare ip-api.com call

### Copy-to-clipboard
- **D-09:** Copy icon appears **on hover** next to each individual value — every `<dd>` in GeoCard/WhoisCard and every data cell in DnsCard record rows
- **D-10:** On click: icon **swaps to a checkmark** for 1.5s then reverts to the copy icon. No toast.
- **D-11:** Use `navigator.clipboard.writeText` — no third-party library
- **D-12:** Labels (e.g. "Country", "Registrar") do NOT get copy buttons — values only

### Dark mode toggle
- **D-13:** Toggle placed **inline with the search bar**, on the right side (same row, outside the `<form>`)
- **D-14:** Shows **Sun icon** when current theme is light / OS-light; shows **Moon icon** when current theme is dark / OS-dark — mirrors the active theme
- **D-15:** Plain **icon button** — no background, no border, subtle hover effect (`ghost` variant)
- **D-16:** Uses `useTheme` from `next-themes` to read and set the theme; `ThemeProvider` is already wired in `layout.tsx`

### Claude's Discretion
- Exact hover transition timing for copy icon swap
- Size of copy/sun/moon icons (suggest `size-4`)
- Whether the search bar row uses `flex` or a wrapper div to accommodate the theme toggle
- Exact Tailwind classes for hover states on copy buttons

</decisions>

<specifics>
## Specific Ideas

- Dark mode toggle mirrors OS preference for icon (sun if light, moon if dark) — same behavior as most modern apps
- Copy feedback is icon-only (checkmark), no toast — keeps it lightweight for a personal tool
- "My IP" failure is silent — the tool is still fully usable without it

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Client orchestration
- `src/components/lookup-dashboard.tsx` — Entry point for all Phase 3 changes: URL param read/write, My IP auto-load, dark mode toggle placement
- `src/hooks/use-lookup.ts` — `lookup(input)` function to call programmatically on mount; `isLoading` and `inputType` state

### API
- `src/app/api/geo/route.ts` — Must be updated to handle missing `q` param (forward bare ip-api.com call for "My IP" feature)

### Cards (copy-to-clipboard targets)
- `src/components/geo-card.tsx` — `<dt>/<dd>` label/value rows; values need copy buttons
- `src/components/dns-card.tsx` — Record data cells in table rows; data column needs copy buttons
- `src/components/whois-card.tsx` — `<dt>/<dd>` rows; values need copy buttons
- `src/components/rdns-card.tsx` — PTR hostname value(s) need copy buttons

### Theme infrastructure
- `src/components/theme-provider.tsx` — `NextThemesProvider` wrapper; already configured
- `src/app/layout.tsx` — `ThemeProvider` with `attribute="class"`, `defaultTheme="system"`, `disableTransitionOnChange`

### UI toolkit
- shadcn `Button` (`ghost` variant) — use for theme toggle button
- lucide-react: `Sun`, `Moon`, `Copy`, `Check` icons

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useTheme()` from `next-themes`: `const { theme, resolvedTheme, setTheme } = useTheme()` — `resolvedTheme` gives the actual active theme (resolves "system" to "light"/"dark"), use this for icon selection
- `lookup(input)`: already exported from `useLookup` — call it programmatically in a `useEffect` for the mount-time auto-load
- `Button` component: supports `variant="ghost"` and `size="icon"` — ideal for the theme toggle

### Established Patterns
- `LookupDashboard` is the sole `'use client'` root — all Phase 3 interactive additions go here or in card components
- Cards use `<dt>/<dd>` pairs (GeoCard, WhoisCard) or `<table>` rows (DnsCard) — copy button placement follows these structures
- `detectInputType` is called inside the hook, not the dashboard — no change needed for URL param feature

### Integration Points
- URL param: `useSearchParams()` + `useRouter()` from `next/navigation` inside `LookupDashboard`
- The `<form>` + theme toggle button need to coexist in the same row — wrap both in a flex container
- `GET /api/geo` currently requires `q` — add a branch for when `q` is absent (call `http://ip-api.com/json/` with no IP segment)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-polish*
*Context gathered: 2026-03-22*
