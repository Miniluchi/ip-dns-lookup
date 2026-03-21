# Technology Stack: Next.js 14+ App Router + shadcn/ui + Tailwind CSS

**Researched:** 2026-03-21
**Sources:** Official Next.js docs (v16.2.1, March 2026), Tailwind CSS docs, training data for shadcn/ui specifics
**Overall confidence:** HIGH (Next.js / Tailwind from official docs), MEDIUM (shadcn/ui — shadcn.com was blocked during fetch)

---

## 1. Project Scaffolding

### Recommended bootstrap command

```bash
npx create-next-app@latest my-app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

Or use the interactive prompt and choose "recommended defaults" — it enables TypeScript, Tailwind CSS, ESLint, App Router, Turbopack, and creates `AGENTS.md` to help coding agents write idiomatic Next.js code.

**Key flags:**
- `--app` — enables App Router (required)
- `--src-dir` — places app code under `src/`, keeping root clean
- `--import-alias "@/*"` — sets up `@/` path aliasing via `tsconfig.json`
- `--typescript` — adds `tsconfig.json` with strict settings
- `--tailwind` — installs and configures Tailwind CSS automatically

**System requirements:** Node.js 20.9+, TypeScript 5.1+

### shadcn/ui initialization (after create-next-app)

```bash
npx shadcn@latest init
```

Prompts:
- Style: **New York** (recommended — tighter spacing, better for dashboards)
- Base color: **Neutral** or **Slate** (neutral palette integrates cleanly)
- CSS variables for colors: **Yes** (required for dark mode to work automatically)

This generates:
- `components.json` — shadcn config file (component style, import aliases, Tailwind path)
- Updates `tailwind.config.ts` — adds CSS variable references and `darkMode: ["class"]`
- Updates `app/globals.css` — injects CSS custom properties for light and dark tokens

### Add components individually

```bash
npx shadcn@latest add card skeleton badge input button tabs
```

Each component is copied into `src/components/ui/` as editable source files — not a black-box dependency.

---

## 2. Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | latest (^15) | Full-stack React framework | App Router, RSC, streaming, route handlers — all built in |
| React | 19 (canary, bundled) | UI library | Used via Next.js; React 19 stable APIs included |
| TypeScript | 5.x | Type safety | Required for `RouteContext<>` helper, component prop types |

### Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | v4 (if new project) or v3 | Utility-first CSS | shadcn/ui is built on Tailwind; dark mode via class variant |
| shadcn/ui | latest CLI | Component library | Copies editable source into your project; no dependency lock-in |

> Note: Tailwind v4 uses `@import "tailwindcss"` and `@custom-variant` syntax instead of `tailwind.config.js`. If starting fresh in 2026, prefer v4. shadcn/ui supports both.

### Supporting Libraries

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `next-themes` | Dark/light mode toggle without FOUC | Always — pairs with shadcn's CSS variable system |
| `server-only` | Marks files as server-exclusive at build time | Add to any `lib/` file using secrets or DB access |
| `clsx` + `tailwind-merge` | Conditional class merging | Already included via shadcn's `cn()` util in `lib/utils.ts` |
| `swr` or `@tanstack/react-query` | Client-side data fetching / cache | For real-time dashboards or client-driven mutations |
| `zod` | Schema validation | Route handler request bodies, form inputs |

---

## 3. App Router Conventions

### File system routing reference

| File | Role |
|------|------|
| `app/layout.tsx` | Root layout — wraps entire app, renders `<html>` and `<body>` |
| `app/page.tsx` | Route page component — publicly accessible |
| `app/loading.tsx` | Suspense fallback — wraps page in `<Suspense>` automatically |
| `app/error.tsx` | React error boundary — must be `"use client"` |
| `app/not-found.tsx` | 404 handler for the segment |
| `app/api/[route]/route.ts` | API route handler — replaces `pages/api/` |

### Route groups (no URL impact)

```
app/
  (dashboard)/
    layout.tsx        # shared dashboard chrome
    overview/page.tsx # /overview
    settings/page.tsx # /settings
  (auth)/
    login/page.tsx    # /login — different root layout possible
```

Wrap folder names in `()` to group routes without adding a URL segment.

### Route handlers (API endpoints)

Place `route.ts` files under `app/api/` (or any path — they just cannot share a folder with `page.tsx`).

```typescript
// app/api/users/route.ts
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  return Response.json({ id })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  // validate with zod, then write to DB
  return Response.json({ created: true }, { status: 201 })
}
```

Dynamic segment params are now a `Promise` (Next.js 15+):

```typescript
// app/api/users/[id]/route.ts
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return Response.json({ id })
}
```

Or use the `RouteContext` helper (auto-typed after `next dev` or `next build`):

```typescript
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/users/[id]'>) {
  const { id } = await ctx.params
  return Response.json({ id })
}
```

---

## 4. Server vs Client Components

### Decision rule

Default to **Server Components** — they have no client JS cost and can access secrets directly. Add `"use client"` only when you need:

- `useState`, `useReducer`, `useEffect`, `useRef`
- Browser APIs (`window`, `localStorage`, `navigator`)
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- Third-party components that depend on the above

### Pattern: push interactivity to the leaves

```typescript
// app/dashboard/page.tsx — Server Component (default)
import { MetricCard } from '@/components/metric-card'
import { getMetrics } from '@/lib/data'

export default async function DashboardPage() {
  const metrics = await getMetrics() // direct DB or fetch, never exposed to client
  return <MetricCard data={metrics} />
}
```

```typescript
// components/metric-card.tsx — Client Component only for interactive bits
'use client'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'

export function MetricCard({ data }: { data: Metric[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  // ...
}
```

### Wrapping third-party components

When a library component uses client hooks but lacks `"use client"` itself:

```typescript
// components/ui/carousel-wrapper.tsx
'use client'
export { Carousel } from 'some-carousel-lib'
```

Import from this wrapper in Server Components.

### Preventing environment poisoning

```typescript
// lib/db.ts — server-only module
import 'server-only'

export async function getUser(id: string) { /* DB query with secret credentials */ }
```

Build will fail if `lib/db.ts` is accidentally imported from a Client Component.

---

## 5. shadcn/ui Components for Dashboards

### Recommended components per use case

| Component | Use Case | Install |
|-----------|----------|---------|
| `Card` + `CardHeader` + `CardContent` + `CardFooter` | Metric tiles, stat boxes | `npx shadcn@latest add card` |
| `Skeleton` | Loading placeholders that match Card shapes | `npx shadcn@latest add skeleton` |
| `Badge` | Status labels (active, inactive, warning) | `npx shadcn@latest add badge` |
| `Input` | Search, filter, form fields | `npx shadcn@latest add input` |
| `Button` | Actions, submit, navigation | `npx shadcn@latest add button` |
| `Tabs` | Switching views (Overview / Analytics / Settings) | `npx shadcn@latest add tabs` |
| `Table` | Data grids | `npx shadcn@latest add table` |
| `Select` | Dropdown filters | `npx shadcn@latest add select` |

### Dashboard Card pattern

```tsx
// components/stat-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface StatCardProps {
  title: string
  value: string | number
  delta?: number
  status?: 'default' | 'secondary' | 'destructive' | 'outline'
}

export function StatCard({ title, value, delta, status = 'default' }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {status && <Badge variant={status}>{status}</Badge>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {delta !== undefined && (
          <p className="text-xs text-muted-foreground">
            {delta > 0 ? '+' : ''}{delta}% from last month
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

### Skeleton loading pattern (matches Card layout)

```tsx
// components/stat-card-skeleton.tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <Skeleton className="h-4 w-[140px]" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-[100px] mb-1" />
        <Skeleton className="h-3 w-[160px]" />
      </CardContent>
    </Card>
  )
}
```

---

## 6. Dark Mode Setup

### How it works

shadcn/ui uses CSS custom properties for all colors. When `darkMode: ["class"]` is set in Tailwind config, adding `class="dark"` to `<html>` switches every component automatically — no per-component dark variants needed.

### Step 1: Tailwind config (auto-set by shadcn init)

**Tailwind v3 (`tailwind.config.ts`):**

```typescript
const config = {
  darkMode: ["class"],
  // ...
}
```

**Tailwind v4 (`globals.css`):**

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

### Step 2: CSS variables (auto-injected by shadcn init into `globals.css`)

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    /* ... all other tokens */
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    /* ... inverted tokens */
  }
}
```

### Step 3: Install next-themes

```bash
npm install next-themes
```

### Step 4: ThemeProvider (Client Component wrapper)

```tsx
// components/theme-provider.tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

### Step 5: Root layout integration

```tsx
// app/layout.tsx
import { ThemeProvider } from '@/components/theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

`suppressHydrationWarning` on `<html>` prevents the hydration mismatch caused by next-themes toggling the class server vs. client.

### Step 6: Toggle button

```tsx
// components/mode-toggle.tsx
'use client'

import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
```

---

## 7. Data Fetching Patterns

### Principle: fetch in Server Components, stream via Suspense

Fetch requests are not cached by default in Next.js 15+. Use `use cache` directive or explicit `cache` option to cache results.

### Pattern 1: Parallel fetch (prevent waterfall)

```typescript
// app/dashboard/page.tsx
export default async function DashboardPage() {
  // Initiate all fetches before awaiting any — they run concurrently
  const usersPromise = getUsers()
  const metricsPromise = getMetrics()
  const revenuePromise = getRevenue()

  const [users, metrics, revenue] = await Promise.all([
    usersPromise,
    metricsPromise,
    revenuePromise,
  ])

  return <Dashboard users={users} metrics={metrics} revenue={revenue} />
}
```

If one fails and you want partial results: use `Promise.allSettled` instead.

### Pattern 2: loading.tsx for route-level skeletons

```tsx
// app/dashboard/loading.tsx
import { StatCardSkeleton } from '@/components/stat-card-skeleton'

export default function Loading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}
```

`loading.tsx` automatically wraps `page.tsx` in a `<Suspense>` boundary. The user sees the skeleton immediately on navigation.

**Caveat:** `loading.tsx` does not cover `layout.tsx`. If your layout accesses uncached data, wrap that data access in its own `<Suspense>` or move it to `page.tsx`.

### Pattern 3: Granular Suspense for independent sections

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'
import { RevenueChart } from '@/components/revenue-chart'
import { RecentSales } from '@/components/recent-sales'
import { StatCardSkeleton } from '@/components/stat-card-skeleton'

export default function DashboardPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Each section streams independently */}
      <Suspense fallback={<StatCardSkeleton />}>
        <RevenueChart />
      </Suspense>
      <Suspense fallback={<StatCardSkeleton />}>
        <RecentSales />
      </Suspense>
    </div>
  )
}
```

Components inside `<Suspense>` must be async Server Components that await their own data:

```typescript
// components/revenue-chart.tsx — async Server Component, no "use client"
import { getRevenue } from '@/lib/data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export async function RevenueChart() {
  const data = await getRevenue() // slow query — streamed independently
  return (
    <Card>
      <CardHeader><CardTitle>Revenue</CardTitle></CardHeader>
      <CardContent>{/* render chart */}</CardContent>
    </Card>
  )
}
```

### Pattern 4: Client-side data with SWR (interactive dashboards)

```tsx
'use client'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function LiveMetric() {
  const { data, error, isLoading } = useSWR('/api/metrics', fetcher, {
    refreshInterval: 5000,
  })
  if (isLoading) return <Skeleton className="h-8 w-24" />
  if (error) return <p className="text-destructive">Failed to load</p>
  return <p className="text-2xl font-bold">{data.value}</p>
}
```

### Pattern 5: React.cache for deduplication

When the same data is needed by multiple Server Components in the same request, wrap the fetch in `React.cache`:

```typescript
// lib/data.ts
import 'server-only'
import { cache } from 'react'

export const getCurrentUser = cache(async () => {
  const res = await fetch('/api/me')
  return res.json()
})
```

Multiple components calling `getCurrentUser()` in the same render share one fetch. Cache is scoped per-request, never shared between users.

---

## 8. TypeScript Conventions

### Component props pattern

```typescript
// Always use explicit interface for component props
interface DashboardCardProps {
  title: string
  value: number
  trend?: 'up' | 'down' | 'neutral'
  className?: string // accept className for composition
}

export function DashboardCard({ title, value, trend = 'neutral', className }: DashboardCardProps) {
  // ...
}
```

### cn() utility (from shadcn init)

```typescript
// lib/utils.ts — created by shadcn init
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Always use `cn()` for conditional Tailwind classes:

```tsx
<div className={cn('base-class', condition && 'conditional-class', className)} />
```

### Async page/layout props

In Next.js 15+, `params` and `searchParams` are `Promise` types:

```typescript
// app/users/[id]/page.tsx
interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function UserPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { tab = 'overview' } = await searchParams
  // ...
}
```

### Route handler typing

```typescript
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const body: unknown = await request.json()
  // validate body with zod before using
  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  // ...
  return Response.json({ id: newUser.id }, { status: 201 })
}
```

### Avoid `any` — use `unknown` for external data

```typescript
// Bad
const data: any = await response.json()

// Good
const data: unknown = await response.json()
const validated = MySchema.parse(data) // zod narrows to the correct type
```

---

## 9. Project Structure (Recommended)

```
src/
  app/
    (dashboard)/          # route group — shared dashboard layout
      layout.tsx          # sidebar, header
      overview/
        page.tsx
        loading.tsx       # skeleton for overview
      settings/
        page.tsx
    api/
      users/
        route.ts          # GET, POST /api/users
        [id]/
          route.ts        # GET, PUT, DELETE /api/users/[id]
    layout.tsx            # root layout with ThemeProvider
    globals.css           # Tailwind base + shadcn CSS variables
  components/
    ui/                   # shadcn-generated components (do not edit manually)
    [feature]/            # your composite components
  lib/
    utils.ts              # cn() helper
    data.ts               # server-only data access functions
  types/
    index.ts              # shared TypeScript interfaces
```

---

## 10. Installation Summary

```bash
# 1. Scaffold
npx create-next-app@latest my-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd my-app

# 2. Initialize shadcn/ui
npx shadcn@latest init

# 3. Add dashboard components
npx shadcn@latest add card skeleton badge input button tabs table select

# 4. Add dark mode support
npm install next-themes

# 5. Optional: server guard + SWR
npm install server-only swr zod
```

---

## 11. Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Component lib | shadcn/ui | Radix UI (direct) | shadcn wraps Radix with pre-styled, editable components — less setup |
| Component lib | shadcn/ui | Chakra UI / MUI | Heavier bundle, opinionated theming conflicts with Tailwind workflow |
| Dark mode | next-themes | Manual class toggle | next-themes handles SSR flash, system preference, persistence |
| Data fetching (server) | native `fetch` + `Promise.all` | tRPC | tRPC adds overhead; native fetch + Zod is sufficient for most APIs |
| Data fetching (client) | SWR | React Query | Both are valid; SWR is lighter and maintained by Vercel (same team) |
| CSS | Tailwind v4 | Tailwind v3 | v4 is current for new projects; v3 is fine if already in use |
| Linter | ESLint | Biome | Biome is faster but ESLint has more Next.js-specific rules |

---

## Sources

- Next.js Installation docs: https://nextjs.org/docs/app/getting-started/installation (v16.2.1, 2026-03-03) — HIGH confidence
- Next.js Data Fetching: https://nextjs.org/docs/app/getting-started/fetching-data (v16.2.1, 2026-03-13) — HIGH confidence
- Next.js Server/Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components (v16.2.1, 2026-03-03) — HIGH confidence
- Next.js Route Handlers: https://nextjs.org/docs/app/api-reference/file-conventions/route (v16.2.1, 2026-03-03) — HIGH confidence
- Next.js loading.js: https://nextjs.org/docs/app/api-reference/file-conventions/loading (v16.2.1, 2026-03-13) — HIGH confidence
- Next.js Project Structure: https://nextjs.org/docs/app/getting-started/project-structure (v16.2.1, 2025-12-09) — HIGH confidence
- Tailwind CSS Dark Mode: https://tailwindcss.com/docs/dark-mode (2026) — HIGH confidence
- shadcn/ui installation, component API, dark mode setup: training data — MEDIUM confidence (shadcn.com was inaccessible during research; patterns are well-established but exact CLI flags should be verified against https://ui.shadcn.com/docs)
