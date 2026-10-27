import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import type { PublicDestination, PublicPackage } from '@/lib/types'

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
  const { data: pk } = await supabase.from('public_packages').select('destination_slug, photos').limit(500)
  const photo = new Map<string, string>()
  for (const p of (pk ?? []) as Pick<PublicPackage, 'destination_slug' | 'photos'>[]) if (p.destination_slug && p.photos?.[0] && !photo.has(p.destination_slug)) photo.set(p.destination_slug, p.photos[0])
  return (
    <div className="wrap page">
      <div className="page__head"><h1>Where would you like to go?</h1><p className="muted">Only places with at least one trip open for booking are listed.</p></div>
      {rows.length === 0 ? (
        <div className="panel"><p><strong>No destinations are open yet.</strong></p><p className="muted">Places appear here as soon as a verified seller publishes a trip there.</p></div>
      ) : (
        <div className="tiles">
          {rows.map((d) => (
            <Link key={d.id} href={`/destinations/${d.slug}`} className="tile">
              {photo.get(d.slug) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.get(d.slug)} alt="" loading="lazy" />
              )}
              <span className="tile__text"><strong>{d.name}</strong><span>{d.state ? `${d.state}, ` : ''}{d.package_count} {d.package_count === 1 ? 'trip' : 'trips'}</span></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
