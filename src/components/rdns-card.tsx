'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle } from 'lucide-react'
import type { CardState, RdnsData } from '@/hooks/use-lookup'
import { CopyButton } from '@/components/copy-button'

interface ReverseDnsCardProps {
  state: CardState<RdnsData>
}

export function ReverseDnsCard({ state }: ReverseDnsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reverse DNS</CardTitle>
      </CardHeader>
      <CardContent>
        {state.status === 'idle' && (
          <p className="text-sm text-muted-foreground">Enter an IP or domain above.</p>
        )}

        {state.status === 'loading' && (
          <div className="flex flex-col gap-y-2">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-48" />
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span className="text-sm">{state.error}</span>
          </div>
        )}

        {state.status === 'success' && state.data && (
          <>
            {state.data.ptr.length === 0 ? (
              <p className="text-sm text-muted-foreground">No PTR records found.</p>
            ) : (
              <ul className="space-y-1">
                {state.data.ptr.map((host, i) => (
                  <li key={i} className="text-sm font-mono">
                    <div className="flex items-center gap-1 group">{host}<CopyButton value={host} /></div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
