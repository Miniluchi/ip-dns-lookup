# Phase 3: Polish - Research

**Researched:** 2026-03-22
**Domain:** Next.js App Router — URL state, clipboard API, next-themes dark mode toggle
**Confidence:** HIGH

## Summary

Phase 3 adds four polish features to an existing Next.js 16 / React 19 app: URL-param bookmarking, "My IP" auto-load, copy-to-clipboard on card values, and a dark/light mode toggle. All four are purely additive changes — no new cards, no new APIs beyond a minor route-handler modification.

All required libraries (`next-themes`, `lucide-react`, `next/navigation`) are already installed and partially wired. The `ThemeProvider` is already in `layout.tsx` with `attribute="class"`, `defaultTheme="system"`, and `disableTransitionOnChange`. The `useTheme` hook, `useSearchParams`, and `useRouter` are all ready to use. The only new code is in `LookupDashboard`, the four card components, and a one-line branch in `/api/geo/route.ts`.

**Primary recommendation:** Use the existing libraries directly — `navigator.clipboard.writeText` for clipboard, `useTheme` from `next-themes` for the toggle, and `useSearchParams` + `useRouter.replace` from `next/navigation` for URL state. Zero new dependencies needed.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**URL param (`?q=`)**
- D-01: URL updates on search submit only — not on every keystroke
- D-02: Use `router.replace` (not `push`) — avoids polluting the back button history
- D-03: On mount, read `?q=` via `useSearchParams` and auto-trigger the lookup if a value is present
- D-04: The search bar input field is populated with the `?q=` value before the lookup fires

**"My IP" auto-load**
- D-05: On initial mount with no `?q=` param: call `GET /api/geo` with no `q` argument — ip-api.com returns the visitor's own IP when called without a parameter
- D-06: On success: populate the search bar with the returned IP and immediately fire the full 4-card lookup
- D-07: On failure: silent fail — show empty search bar, user types manually. No error message shown.
- D-08: The `/api/geo` route must accept a missing `q` param and forward the bare ip-api.com call

**Copy-to-clipboard**
- D-09: Copy icon appears on hover next to each individual value — every `<dd>` in GeoCard/WhoisCard and every data cell in DnsCard record rows
- D-10: On click: icon swaps to a checkmark for 1.5s then reverts to the copy icon. No toast.
- D-11: Use `navigator.clipboard.writeText` — no third-party library
- D-12: Labels (e.g. "Country", "Registrar") do NOT get copy buttons — values only

**Dark mode toggle**
- D-13: Toggle placed inline with the search bar, on the right side (same row, outside the `<form>`)
- D-14: Shows Sun icon when current theme is light / OS-light; shows Moon icon when current theme is dark / OS-dark — mirrors the active theme
- D-15: Plain icon button — no background, no border, subtle hover effect (`ghost` variant)
- D-16: Uses `useTheme` from `next-themes` to read and set the theme; `ThemeProvider` is already wired in `layout.tsx`

### Claude's Discretion
- Exact hover transition timing for copy icon swap
- Size of copy/sun/moon icons (suggest `size-4`)
- Whether the search bar row uses `flex` or a wrapper div to accommodate the theme toggle
- Exact Tailwind classes for hover states on copy buttons

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-03 | URL `?q=` param is set on search, enabling shareable/bookmarkable lookups | `useSearchParams` + `useRouter.replace` from `next/navigation`; `router.replace` with current pathname and new search params on form submit |
| SRCH-04 | Page loads with user's own IP pre-populated (via ip-api.com no-arg call) | `useEffect` on mount checks `searchParams.get('q')`; if absent calls `GET /api/geo` (no q) then populates `input` state and calls `lookup(ip)`; `/api/geo` route needs a new branch when `q` is null |
| UI-02 | Dark/light mode toggle using next-themes | `next-themes` ^0.4.6 already installed; `ThemeProvider` already configured; `useTheme()` gives `resolvedTheme` + `setTheme`; shadcn `Button` ghost+icon variant; lucide `Sun`/`Moon` icons |
| UI-03 | Copy-to-clipboard button on individual record values | `navigator.clipboard.writeText` (no library); local `useState` per-value or single component abstraction; `Copy`/`Check` from lucide-react; icon appears on hover, reverts after 1.5 s |
</phase_requirements>

---

## Standard Stack

### Core (all already installed)

| Library | Version in package.json | Purpose | Why Standard |
|---------|------------------------|---------|--------------|
| next-themes | ^0.4.6 | `useTheme` hook, ThemeProvider | De-facto standard for Next.js dark mode; already wired |
| lucide-react | ^0.577.0 | `Sun`, `Moon`, `Copy`, `Check` icons | Already used throughout the project |
| next/navigation | (Next 16.2.1) | `useSearchParams`, `useRouter` | App Router standard — no external dep |

### No New Installations Required

All dependencies are present. No `npm install` step is needed for this phase.

---

## Architecture Patterns

### Pattern 1: URL param read/write in LookupDashboard

`LookupDashboard` must add `useSearchParams()` and `useRouter()`. Because `useSearchParams` requires a Suspense boundary in Next.js App Router when used in a Client Component that is NOT a page-level component, the component must either be wrapped in `<Suspense>` in `page.tsx`, or the param reading must stay in a sub-component.

**Current situation:** `page.tsx` is a Server Component that renders `<LookupDashboard />` directly. `LookupDashboard` is already `'use client'`. Adding `useSearchParams()` directly to it will trigger the "Missing Suspense boundary" warning/build error in Next.js.

**Correct pattern:** Wrap `<LookupDashboard />` in a `<Suspense fallback={null}>` inside `page.tsx`.

```tsx
// src/app/page.tsx
import { Suspense } from 'react'
import { LookupDashboard } from '@/components/lookup-dashboard'

export default function Home() {
  return (
    <Suspense fallback={null}>
      <LookupDashboard />
    </Suspense>
  )
}
```

Inside `LookupDashboard`:

```tsx
// Source: Next.js App Router docs — useSearchParams
'use client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

// On form submit:
const router = useRouter()
const pathname = usePathname()
const searchParams = useSearchParams()

// update URL without polluting history:
router.replace(`${pathname}?q=${encodeURIComponent(sanitized)}`)
```

### Pattern 2: Mount-time effects for URL param and My IP auto-load

Two effects run on mount, in this priority order:
1. If `?q=` param is present: populate input, call `lookup(q)`
2. Else: call `GET /api/geo` (no q arg), get visitor IP, populate input, call `lookup(ip)`

```tsx
// Source: existing useLookup hook + Next.js useSearchParams
useEffect(() => {
  const q = searchParams.get('q')
  if (q) {
    setInput(q)
    lookup(q)
    return
  }
  // My IP fallback
  fetch('/api/geo')
    .then((res) => res.json())
    .then((data) => {
      if (data?.query) {
        setInput(data.query)
        lookup(data.query)
      }
    })
    .catch(() => {
      // D-07: silent fail
    })
}, []) // empty deps — runs once on mount
```

**Important:** `lookup` from `useLookup` is stable (`useCallback` with `[]` deps) so it is safe to omit from the effect dependency array. Using `lookup` in deps would re-run the effect every render — do NOT add it.

### Pattern 3: /api/geo route — bare call for visitor IP

ip-api.com returns the visitor's own IP when called without an IP segment:

```
http://ip-api.com/json/
```

The returned JSON includes a `query` field containing the detected public IP. The route already calls `http://ip-api.com/json/${encodeURIComponent(q)}` — when `q` is absent, call `http://ip-api.com/json/` instead.

```ts
// src/app/api/geo/route.ts  (updated branch)
const q = request.nextUrl.searchParams.get('q')

if (!q) {
  // No q param → return visitor's own IP via bare ip-api.com call
  const res = await fetch(
    'http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query',
    { cache: 'no-store' }
  )
  // ... same ok/fail handling as existing code
}
```

**The `isPrivateIp` check must be skipped when `q` is null** — the visitor IP could be any routable address.

### Pattern 4: CopyButton component (reusable)

A small `CopyButton` component encapsulates hover-show + icon-swap behavior. This avoids duplicating the `useState` + `setTimeout` logic across four card files.

```tsx
// src/components/copy-button.tsx
'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CopyButtonProps {
  value: string
  className?: string
}

export function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`size-6 opacity-0 group-hover:opacity-100 transition-opacity ${className ?? ''}`}
      onClick={handleCopy}
      aria-label="Copy value"
    >
      {copied
        ? <Check className="size-3" />
        : <Copy className="size-3" />}
    </Button>
  )
}
```

Usage in `<dd>` rows: wrap `<dd>` in `<div className="flex items-center gap-1 group">` and append `<CopyButton value={...} />`.

Usage in `DnsCard` `<td>`: wrap the cell content in `<span className="flex items-center gap-1 group">` and append `<CopyButton value={rec.data} />`.

**Note on card Server vs Client:** `GeoCard`, `DnsCard`, `WhoisCard`, and `ReverseDnsCard` are currently Server Components (no `'use client'` directive). Adding `CopyButton` (which uses `useState`) into them will force them to become Client Components. Add `'use client'` to each card file that receives copy buttons.

### Pattern 5: Dark mode toggle

```tsx
// Inside LookupDashboard — uses useTheme from next-themes
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

const { resolvedTheme, setTheme } = useTheme()

// Toggle button (outside the <form>, in same flex row):
<Button
  variant="ghost"
  size="icon"
  onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
  aria-label="Toggle theme"
>
  {resolvedTheme === 'dark'
    ? <Sun className="size-4" />
    : <Moon className="size-4" />}
</Button>
```

`resolvedTheme` resolves the `"system"` value to `"light"` or `"dark"` based on OS preference, which is what D-14 requires. Using `theme` instead of `resolvedTheme` would show the wrong icon when `theme === "system"`.

**Flash of unstyled content (FOUC):** The `ThemeProvider` in `layout.tsx` already has `disableTransitionOnChange` and `suppressHydrationWarning` on `<html>`. next-themes injects a blocking script that sets the class before React hydrates, so no FOUC occurs. No additional work needed.

### Anti-Patterns to Avoid

- **Using `theme` instead of `resolvedTheme` for icon selection:** `theme` can be `"system"`, which matches neither `"light"` nor `"dark"`, causing the wrong icon to render. Always use `resolvedTheme`.
- **Adding `lookup` to the mount `useEffect` dependency array:** `lookup` is `useCallback([])` stable, but React lint rules may flag it. Adding it causes the effect to re-run after every lookup, creating an infinite loop. Suppress the lint rule with a comment or extract the effect into a ref pattern.
- **Forgetting `Suspense` wrapper for `useSearchParams`:** In Next.js App Router, `useSearchParams()` in a client component below a page will cause a build warning or error if not wrapped in `Suspense`. Always wrap at the page level.
- **Calling `router.push` instead of `router.replace`:** `push` adds a history entry so pressing Back after every search fills the stack. Use `replace` as per D-02.
- **Setting cards as Server Components after adding `CopyButton`:** `CopyButton` uses `useState` (client-side). Any component that imports it must add `'use client'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme persistence + FOUC prevention | Custom script injection in `<head>` | `next-themes` (already installed) | next-themes injects a blocking script that prevents flash; hand-rolled solutions miss SSR edge cases |
| Clipboard API wrapper | Custom clipboard util | `navigator.clipboard.writeText` directly | The native API is sufficient; no polyfill needed for modern browsers |
| URL state management | Custom history manipulation | `useRouter.replace` + `useSearchParams` | App Router hooks handle SSR, hydration, and Suspense correctly |

---

## Common Pitfalls

### Pitfall 1: `useSearchParams` without Suspense boundary

**What goes wrong:** Next.js 14+ requires `useSearchParams()` to be used inside a component that is wrapped in `<Suspense>`. Without it, the build may emit an error or the component opts the entire route into client-side rendering.

**Why it happens:** During static rendering, search params are not available on the server. Next.js needs a Suspense boundary to know where to fall back while params are being resolved.

**How to avoid:** In `page.tsx`, wrap `<LookupDashboard />` in `<Suspense fallback={null}>`.

**Warning signs:** Build output includes "Missing Suspense boundary with useSearchParams" error or warning.

---

### Pitfall 2: `useTheme` returning `undefined` on first render

**What goes wrong:** On the first render (SSR / before hydration), `resolvedTheme` is `undefined` because next-themes has not yet read the stored theme. Conditional `{resolvedTheme === 'dark' ? ... : ...}` will render the wrong icon.

**Why it happens:** next-themes intentionally suppresses hydration mismatch by deferring theme resolution to the client.

**How to avoid:** Guard with `resolvedTheme ?? 'light'` as a fallback, or render a neutral placeholder until `resolvedTheme` is available:

```tsx
{!resolvedTheme ? null : resolvedTheme === 'dark'
  ? <Sun className="size-4" />
  : <Moon className="size-4" />}
```

**Warning signs:** Moon/sun icon flips on hydration, or console hydration mismatch warning.

---

### Pitfall 3: Infinite loop in mount effect

**What goes wrong:** If `lookup` is listed in the `useEffect` deps, the effect re-runs whenever `lookup` changes. Even though `lookup` is `useCallback([])`, adding it to deps is semantically valid but causes re-execution after the first lookup completes (due to state changes in the hook).

**Why it happens:** React's exhaustive-deps lint rule encourages adding all used values to deps, but not all stable callbacks are safe to add when they trigger state updates used by the effect.

**How to avoid:** Keep the mount effect deps array empty (`[]`). Add a comment: `// eslint-disable-next-line react-hooks/exhaustive-deps` if the linter flags it.

---

### Pitfall 4: Copy button visible on mobile (no hover)

**What goes wrong:** Using `opacity-0 group-hover:opacity-100` hides copy buttons completely on touch devices since hover events don't fire reliably on mobile.

**Why it happens:** CSS hover states don't persist after touch on most mobile browsers.

**How to avoid:** This is accepted behavior for a personal desktop tool (per requirements). If needed in the future, `@media (hover: none)` can be used to always show the icon at reduced opacity on touch devices. For this phase, leave it as-is.

---

## Code Examples

### Verified: useSearchParams + router.replace (Next.js App Router)

```tsx
// Source: Next.js 14+ App Router documentation
'use client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

const router = useRouter()
const pathname = usePathname()
const searchParams = useSearchParams()

// On form submit — replaces history entry, doesn't push:
const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  setValidationError(null)
  const result = await lookup(input)
  if (!result.valid) {
    setValidationError('Enter a valid IP address or domain')
    return
  }
  router.replace(`${pathname}?q=${encodeURIComponent(input.trim())}`)
}
```

### Verified: next-themes useTheme (resolvedTheme)

```tsx
// Source: next-themes README / package docs
import { useTheme } from 'next-themes'
const { resolvedTheme, setTheme } = useTheme()

// resolvedTheme is 'light' | 'dark' | undefined
// Use for icon selection and toggle logic
setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
```

### Verified: ip-api.com bare call returns visitor IP

```
GET http://ip-api.com/json/?fields=status,message,country,...,query
```

Response includes `query: "203.0.113.42"` (the caller's IP). Confirmed by ip-api.com documentation behavior — no IP segment in the URL path means "detect caller".

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.0 |
| Config file | none — vitest reads from package.json |
| Quick run command | `npm test` (`vitest run --passWithNoTests`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-03 | URL `?q=` param set on submit | unit (node, no jsdom) | `npm test` | ❌ Wave 0 |
| SRCH-04 | My IP auto-load fires on mount with no `?q=` | unit (mock fetch) | `npm test` | ❌ Wave 0 |
| UI-02 | Theme toggle switches resolvedTheme | manual-only | — | N/A (DOM/CSS) |
| UI-03 | Clipboard write called with correct value | unit (mock clipboard) | `npm test` | ❌ Wave 0 |

**UI-02 is manual-only:** Dark mode toggle behavior (FOUC prevention, icon swap, OS pref detection) requires a real browser. Vitest in node environment cannot test CSS class application or `window.matchMedia`.

### Sampling Rate

- Per task commit: `npm test`
- Per wave merge: `npm test`
- Phase gate: Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/app/api/geo/route.test.ts` — covers SRCH-04 (bare `/api/geo` call returns visitor IP shape)
- [ ] `src/components/copy-button.test.ts` — covers UI-03 (clipboard.writeText called with value, icon swap after 1.5s)
- [ ] `src/components/lookup-dashboard.test.ts` — covers SRCH-03 (router.replace called with `?q=` on submit) and SRCH-04 (mount effect: fetch `/api/geo` when no `?q=` param)

**Note:** Existing `src/hooks/use-lookup.test.ts` and `src/lib/detect-input-type.test.ts` do not need modification for this phase.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next/router` (Pages Router) | `next/navigation` (App Router) | Next.js 13 | `useRouter`, `useSearchParams`, `usePathname` are separate hooks |
| `class` attribute via JS | CSS variables + Tailwind dark: prefix | next-themes + Tailwind 4 | Theme switching handled via `[data-theme]` or `.dark` class; no manual style injection |

---

## Open Questions

1. **`useEffect` deps lint warning for `lookup`**
   - What we know: `lookup` is `useCallback([])` — stable across renders
   - What's unclear: Whether the project ESLint config enforces `react-hooks/exhaustive-deps`
   - Recommendation: Add `// eslint-disable-next-line react-hooks/exhaustive-deps` above the mount effect if the linter flags it

2. **Card components becoming Client Components**
   - What we know: Adding `CopyButton` (which uses `useState`) requires each card to add `'use client'`
   - What's unclear: Whether making 4 more components client-side has any performance implication in this app
   - Recommendation: Add `'use client'` to each card file that gets copy buttons; the impact is negligible since the entire subtree is already under a client boundary (`LookupDashboard`)

---

## Sources

### Primary (HIGH confidence)

- Codebase direct read — `src/components/lookup-dashboard.tsx`, `src/hooks/use-lookup.ts`, `src/app/api/geo/route.ts`, `src/app/layout.tsx`, `src/components/theme-provider.tsx`, all four card components
- `package.json` — confirmed installed versions: next-themes ^0.4.6, lucide-react ^0.577.0, Next.js 16.2.1
- ip-api.com documented behavior: bare `http://ip-api.com/json/` (no IP segment) returns caller IP in `query` field

### Secondary (MEDIUM confidence)

- Next.js App Router docs pattern for `useSearchParams` + Suspense boundary requirement — established pattern in Next.js 13+
- next-themes `resolvedTheme` vs `theme` distinction — from next-themes README behavior

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — all integration points read directly from existing source files
- Pitfalls: HIGH — derived from direct code analysis (Suspense requirement, useEffect deps, resolvedTheme undefined on SSR)

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack — next-themes and Next.js App Router APIs are stable)
