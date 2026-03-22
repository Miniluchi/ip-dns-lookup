'use client'

import { useState } from 'react'
import { useLookup } from '@/hooks/use-lookup'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { GeoCard } from '@/components/geo-card'
import { DnsCard } from '@/components/dns-card'
import { ReverseDnsCard } from '@/components/rdns-card'
import { WhoisCard } from '@/components/whois-card'

export function LookupDashboard() {
  const [input, setInput] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const { state, inputType, isLoading, lookup } = useLookup()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setValidationError(null)
    const result = await lookup(input)
    if (!result.valid) {
      setValidationError('Enter a valid IP address or domain')
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="IP address or domain\u2026"
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

      <div className="mt-8 grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-2">
        <GeoCard state={state.geo} />
        <DnsCard state={state.dns} />
        {inputType !== 'domain' && <ReverseDnsCard state={state.rdns} />}
        <WhoisCard state={state.whois} />
      </div>
    </main>
  )
}
