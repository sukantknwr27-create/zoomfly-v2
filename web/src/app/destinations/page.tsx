import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import type { PublicDestination } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Destinations',
  description: 'Places you can book tours to on ZoomFly, from verified Indian operators, with real dates and seats.',
  alternates: { canonical: '/destinations' },
}
export const dynamic = 'force-dynamic'

export default async function Destinations() {
  const supabase = createClient()
  const { data } = await supabase.from('public_destinations').select('id, slug, name, state, package_count').order('name')
  const rows = (data ?? []) as PublicDestination[]
  return (
    <div className="wrap page">
      <div className="page__head"><h1>Destinations</h1><p className="muted">Only places with at least one trip open for booking are listed.</p></div>
      {rows.length === 0 ? (
        <div className="panel"><p><strong>No destinations are open yet.</strong></p><p className="muted">Places appear here as soon as a verified seller publishes a trip there.</p></div>
      ) : (
        <ul className="chips" style={{ gap: 14 }}>
          {rows.map((d) => (
            <li key={d.id}><Link className="chip" href={`/destinations/${d.slug}`}>{d.name}{d.state ? `, ${d.state}` : ''} ({d.package_count})</Link></li>
          ))}
        </ul>
      )}
    </div>
  )
}
