import Link from 'next/link'
import { getSaved } from '@/lib/saved'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TripCard } from '@/components/TripCard'
import { abs } from '@/lib/site'
import { JsonLd } from '@/components/JsonLd'
import type { PublicDeparture, PublicDestination, PublicPackage } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function load(slug: string) {
  const supabase = createClient()
  const { data: d } = await supabase.from('public_destinations').select('id, slug, name, state, description, package_count').eq('slug', slug).maybeSingle()
  return { supabase, dest: d as (PublicDestination & { description: string | null }) | null }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { dest } = await load(params.slug)
  if (!dest) return { title: 'Destination not found', robots: { index: false } }
  const title = `Trips to ${dest.name}${dest.state ? `, ${dest.state}` : ''}`
  const description = `${dest.package_count} ${dest.package_count === 1 ? 'trip' : 'trips'} to ${dest.name} from verified operators, with real departure dates, real seat counts and all-in prices.`
  return { title, description, alternates: { canonical: `/destinations/${dest.slug}` }, openGraph: { title, description, url: abs(`/destinations/${dest.slug}`), type: 'website' } }
}

export default async function DestinationPage({ params }: { params: { slug: string } }) {
  const { supabase, dest } = await load(params.slug)
  if (!dest) notFound()
  const { data: pk } = await supabase.from('public_packages').select('*').eq('destination_slug', dest.slug).order('is_featured', { ascending: false }).order('next_departure_date')
  const trips = (pk ?? []) as PublicPackage[]
  const { data: deps } = trips.length ? await supabase.from('public_package_departures').select('*').in('package_id', trips.map((t) => t.id)).order('departure_date') : { data: [] }
  const next = new Map<string, PublicDeparture>()
  for (const d of (deps ?? []) as PublicDeparture[]) if (!next.has(d.package_id)) next.set(d.package_id, d)

  const saved = await getSaved()
  const here = `/destinations/${params.slug}`

  return (
    <div className="wrap page">
      <JsonLd data={[
        { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'ZoomFly', item: abs('/') },
          { '@type': 'ListItem', position: 2, name: 'Destinations', item: abs('/destinations') },
          { '@type': 'ListItem', position: 3, name: dest.name, item: abs(`/destinations/${dest.slug}`) } ] },
        { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: trips.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`/trips/${t.slug}`), name: t.title })) },
      ]} />
      <section className="dest-hero">
        {trips[0]?.photos?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={trips[0].photos[0]} alt="" />
        )}
        <p className="crumbs"><Link href="/destinations">Destinations</Link></p>
        <h1>Trips to {dest.name}</h1>
        <p>{dest.description || `${trips.length} ${trips.length === 1 ? 'trip is' : 'trips are'} open for booking${dest.state ? ` in ${dest.state}` : ''}. Each comes from a verified seller, with real dates and seats.`}</p>
      </section>
      <div className="cards">
        {trips.map((p) => <TripCard key={p.id} p={p} next={next.get(p.id)} saved={saved} here={here} />)}
      </div>
    </div>
  )
}
