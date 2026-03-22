'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useLookup } from '@/hooks/use-lookup'
import { Button } from '@/components/ui/button'
import { Loader2, Sun, Moon } from 'lucide-react'
import { GeoCard } from '@/components/geo-card'
import { DnsCard } from '@/components/dns-card'
import { ReverseDnsCard } from '@/components/rdns-card'
import { WhoisCard } from '@/components/whois-card'

export function LookupDashboard() {
  const [input, setInput] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const { state, inputType, isLoading, lookup } = useLookup()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setInput(q)
      lookup(q)
      return
    }
    // My IP fallback — silent fail per D-07
    fetch('/api/geo')
      .then((res) => res.json())
      .then((data) => {
        if (data?.query) {
          setInput(data.query)
          lookup(data.query)
        }
      })
      .catch(() => {
        // D-07: silent fail — no error shown
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setValidationError(null)
    const result = await lookup(input)
    if (!result.valid) {
      setValidationError('Enter a valid IP address or domain')
    } else {
      router.replace(`${pathname}?q=${encodeURIComponent(input.trim())}`)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12">
      <div className="flex items-center gap-2 w-full max-w-2xl">
        <form onSubmit={handleSubmit} className="flex-1">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"IP address or domain\u2026"}
              disabled={isLoading}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Search
            </Button>
          </div>
          {validationError && (
            <p className="mt-1 text-sm text-destructive">{validationError}</p>
          )}
        </form>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          {!resolvedTheme ? null : resolvedTheme === 'dark'
            ? <Sun className="size-4" />
            : <Moon className="size-4" />}
        </Button>
      </div>

      <div className="mt-8 grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-2">
        <GeoCard state={state.geo} />
        <DnsCard state={state.dns} />
        {inputType !== 'domain' && <ReverseDnsCard state={state.rdns} />}
        <WhoisCard state={state.whois} />
      </div>
    </main>
  )
}
