import { Suspense } from 'react'
import { LookupDashboard } from '@/components/lookup-dashboard'

export default function Home() {
  return (
    <Suspense fallback={null}>
      <LookupDashboard />
    </Suspense>
  )
}
