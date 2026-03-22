'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle } from 'lucide-react'
import type { CardState, DnsData } from '@/hooks/use-lookup'
import { CopyButton } from '@/components/copy-button'

const RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'] as const

interface DnsCardProps {
  state: CardState<DnsData>
}

export function DnsCard({ state }: DnsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>DNS Records</CardTitle>
      </CardHeader>
      <CardContent>
        {state.status === 'idle' && (
          <p className="text-sm text-muted-foreground">Enter an IP or domain above.</p>
        )}

        {state.status === 'loading' && (
          <div className="flex flex-col gap-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span className="text-sm">{state.error}</span>
          </div>
        )}

        {state.status === 'success' && state.data && (() => {
          const populated = RECORD_TYPES.filter(
            (type) => (state.data!.records[type]?.length ?? 0) > 0
          )
          if (populated.length === 0) {
            return <p className="text-sm text-muted-foreground">No DNS records found.</p>
          }
          return (
            <div>
              {populated.map((type) => (
                <section key={type}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-3 mb-1">
                    {type} Records
                  </h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {state.data!.records[type].map((rec, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="py-1 font-mono"><span className="flex items-center gap-1 group">{rec.data}<CopyButton value={rec.data} /></span></td>
                          <td className="py-1 text-right text-muted-foreground tabular-nums">
                            {rec.TTL}s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          )
        })()}
      </CardContent>
    </Card>
  )
}
