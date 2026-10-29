import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { getSaved } from '@/lib/saved'
import { TripRow } from '@/components/TripRow'
import { IconCompass } from '@/components/Icons'
import type { PublicDeparture, PublicPackage } from '@/lib/types'

export const metadata: Metadata = { title: 'Saved trips', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function SavedTrips() {
  const user = await requireUser('/saved')
  const supabase = createClient()
  const { data: rows } = await supabase.from('saved_packages').select('package_id, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
  const ids = (rows ?? []).map((r: { package_id: string }) => r.package_id)
  const { data: pk } = ids.length ? await supabase.from('public_packages').select('*').in('id', ids) : { data: [] }
  const byId = new Map(((pk ?? []) as PublicPackage[]).map((p) => [p.id, p]))
  const trips = ids.map((id) => byId.get(id)).filter(Boolean) as PublicPackage[]
  const { data: deps } = trips.length ? await supabase.from('public_package_departures').select('*').in('package_id', trips.map((t) => t.id)).order('departure_date') : { data: [] }
  const next = new Map<string, PublicDeparture>()
  for (const d of (deps ?? []) as PublicDeparture[]) if (!next.has(d.package_id)) next.set(d.package_id, d)
  const saved = await getSaved()
  const hidden = ids.length - trips.length
  return (
    <div className="wrap page">
      <div className="page__head"><h1>Saved trips</h1><p className="muted" style={{ marginBottom: 0 }}>Trips you want to come back to. Only you can see this list.</p></div>
      {trips.length === 0 ? (
        <div className="panel empty">
          <IconCompass />
          <p><strong>You have not saved any trips yet.</strong></p>
          <p className="muted">Tap the heart on a trip to keep it here.</p>
          <Link className="btn btn--primary" href="/trips">Browse trips</Link>
        </div>
      ) : (
        <div className="rows">{trips.map((p) => <TripRow key={p.id} p={p} next={next.get(p.id)} saved={saved} here="/saved" />)}</div>
      )}
      {hidden > 0 && <p className="muted small" style={{ marginTop: 16 }}>{hidden} saved {hidden === 1 ? 'trip is' : 'trips are'} not open for booking right now and {hidden === 1 ? 'is' : 'are'} hidden.</p>}
    </div>
  )
}
