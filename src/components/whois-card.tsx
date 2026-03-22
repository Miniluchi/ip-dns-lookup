import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle } from 'lucide-react'
import type { CardState, WhoisData } from '@/hooks/use-lookup'

interface WhoisCardProps {
  state: CardState<WhoisData>
}

export function WhoisCard({ state }: WhoisCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>WHOIS</CardTitle>
      </CardHeader>
      <CardContent>
        {state.status === 'idle' && (
          <p className="text-sm text-muted-foreground">Enter an IP or domain above.</p>
        )}

        {state.status === 'loading' && (
          <div className="flex flex-col gap-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-x-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span className="text-sm">{state.error}</span>
          </div>
        )}

        {state.status === 'success' && state.data && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-sm text-muted-foreground">Registrar</dt>
            <dd className="text-sm">{state.data.registrar ?? '\u2014'}</dd>

            <dt className="text-sm text-muted-foreground">Created</dt>
            <dd className="text-sm">{state.data.creationDate ?? '\u2014'}</dd>

            <dt className="text-sm text-muted-foreground">Expires</dt>
            <dd className="text-sm">{state.data.expirationDate ?? '\u2014'}</dd>

            <dt className="text-sm text-muted-foreground">Nameservers</dt>
            <dd className="text-sm">
              {state.data.nameservers.length === 0 ? (
                '\u2014'
              ) : (
                <ul className="space-y-0.5">
                  {state.data.nameservers.map((ns, i) => (
                    <li key={i} className="font-mono text-sm">
                      {ns}
                    </li>
                  ))}
                </ul>
              )}
            </dd>

            <dt className="text-sm text-muted-foreground">Status</dt>
            <dd className="text-sm">
              {state.data.status.length === 0 ? (
                '\u2014'
              ) : (
                <div className="flex flex-wrap gap-1">
                  {state.data.status.map((code, i) => (
                    <code
                      key={i}
                      className="text-xs font-mono bg-muted px-1 rounded"
                    >
                      {code}
                    </code>
                  ))}
                </div>
              )}
            </dd>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
