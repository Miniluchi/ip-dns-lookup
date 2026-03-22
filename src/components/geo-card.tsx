import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle } from 'lucide-react'
import type { CardState, GeoData } from '@/hooks/use-lookup'

interface GeoCardProps {
  state: CardState<GeoData>
}

export function GeoCard({ state }: GeoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Geolocation</CardTitle>
      </CardHeader>
      <CardContent>
        {state.status === 'idle' && (
          <p className="text-sm text-muted-foreground">Enter an IP or domain above.</p>
        )}

        {state.status === 'loading' && (
          <div className="flex flex-col gap-y-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="flex gap-x-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-32" />
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
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-sm text-muted-foreground">Country</dt>
            <dd className="text-sm">{state.data.country}</dd>

            <dt className="text-sm text-muted-foreground">City</dt>
            <dd className="text-sm">{state.data.city}</dd>

            <dt className="text-sm text-muted-foreground">Region</dt>
            <dd className="text-sm">{state.data.regionName}</dd>

            <dt className="text-sm text-muted-foreground">ISP</dt>
            <dd className="text-sm">{state.data.isp}</dd>

            <dt className="text-sm text-muted-foreground">Org</dt>
            <dd className="text-sm">{state.data.org}</dd>

            <dt className="text-sm text-muted-foreground">AS</dt>
            <dd className="text-sm">{state.data.as}</dd>

            <dt className="text-sm text-muted-foreground">Timezone</dt>
            <dd className="text-sm">{state.data.timezone}</dd>

            <dt className="text-sm text-muted-foreground">Lat</dt>
            <dd className="text-sm">{state.data.lat}</dd>

            <dt className="text-sm text-muted-foreground">Lon</dt>
            <dd className="text-sm">{state.data.lon}</dd>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
