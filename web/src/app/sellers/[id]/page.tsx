import Link from 'next/link'
import { getSaved } from '@/lib/saved'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Banner } from '@/components/Banner'
import { TripRow } from '@/components/TripRow'
import { RatingSummary, ReviewList } from '@/components/ReviewBits'
import { IconBag, IconPin, IconShield, IconStar } from '@/components/Icons'
import type { ReviewRow } from '@/lib/reviews'
import type { PublicDeparture, PublicPackage } from '@/lib/types'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Seller = { id: string; business_name: string; logo_url: string | null; description: string | null; city: string | null; state: string | null; avg_rating: number | null; review_count: number; is_verified: boolean }

async function load(id: string) {
  if (!UUID.test(id)) return null
  const { data } = await createClient().from('public_sellers').select('id, business_name, logo_url, description, city, state, avg_rating, review_count, is_verified').eq('id', id).maybeSingle()
  return (data as Seller | null) ?? null
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const s = await load(params.id)
  return s ? { title: s.business_name, description: s.description?.slice(0, 160) || `Trips by ${s.business_name} on ZoomFly.`, alternates: { canonical: `/sellers/${s.id}` } } : { title: 'Seller' }
}

export default async function SellerPage({ params }: { params: { id: string } }) {
  const s = await load(params.id)
  if (!s) notFound()
  const supabase = createClient()
  const [{ data: pk }, { data: rv }] = await Promise.all([
    supabase.from('public_packages').select('*').eq('seller_id', s.id).order('next_departure_date', { ascending: true }).limit(24),
    supabase.from('public_reviews').select('id, package_id, seller_id, overall, matched_listing, comment, reviewer_first_name, created_at').eq('seller_id', s.id).order('created_at', { ascending: false }).limit(200),
  ])
  const trips = (pk ?? []) as PublicPackage[]
  const reviews = (rv ?? []) as ReviewRow[]
  const { data: deps } = trips.length ? await supabase.from('public_package_departures').select('*').in('package_id', trips.map((t) => t.id)).order('departure_date') : { data: [] }
  const next = new Map<string, PublicDeparture>()
  for (const d of (deps ?? []) as PublicDeparture[]) if (!next.has(d.package_id)) next.set(d.package_id, d)
  const titles = new Map(trips.map((t) => [t.id, { title: t.title, slug: t.slug }]))
  const place = [s.city, s.state].filter(Boolean).join(', ')

  const saved = await getSaved()
  const here = `/sellers/${s.id}`

  return (
    <>
      <Banner crumbs={<><Link href="/sellers">Sellers</Link> / {s.business_name}</>} title={<span style={{ display: 'none' }}>{s.business_name}</span>}>
        <div className="seller-head" style={{ marginTop: -56 }}>
          <span className="seller-logo">{s.logo_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.logo_url} alt="" /> : s.business_name.charAt(0)}</span>
          <div>
            {s.is_verified && <span className="badge-ok"><IconShield />Verified seller</span>}
            <h2 style={{ color: '#fff', fontSize: 'clamp(1.6rem, 3.4vw, 2.4rem)', margin: 0 }}>{s.business_name}</h2>
            <div className="seller-meta">
              {place && <span><IconPin />{place}</span>}
              <span><IconBag />{trips.length} {trips.length === 1 ? 'trip' : 'trips'} open</span>
              {s.avg_rating !== null && s.review_count > 0 && <span><IconStar />{Number(s.avg_rating).toFixed(1)} ({s.review_count} {s.review_count === 1 ? 'review' : 'reviews'})</span>}
            </div>
          </div>
          <div />
        </div>
      </Banner>

      <div className="wrap page">
        <nav className="tabs" aria-label="On this page"><a href="#trips">Trips</a><a href="#about">About</a><a href="#reviews">Reviews</a></nav>
        <div className="layout-2">
          <div>
            <section id="trips" style={{ scrollMarginTop: 90 }}>
              <h2>Trips by {s.business_name}</h2>
              {trips.length === 0 ? <div className="panel"><p className="muted" style={{ margin: 0 }}>No trips are open for booking right now.</p></div> : <div className="rows">{trips.map((p) => <TripRow key={p.id} p={p} next={next.get(p.id)} saved={saved} here={here} />)}</div>}
            </section>
            <section id="reviews" className="section" style={{ scrollMarginTop: 90 }}>
              <h2>Traveller reviews</h2>
              <div className="panel">{reviews.length === 0 ? <p className="muted" style={{ margin: 0 }}>No reviews yet.</p> : <ReviewList rows={reviews.slice(0, 10)} titles={titles} />}</div>
            </section>
          </div>
          <aside className="rail">
            <div id="about" className="panel" style={{ scrollMarginTop: 90 }}>
              <h2>About {s.business_name}</h2>
              <p className="muted" style={{ marginBottom: 12 }}>{s.description || 'This seller has not added a description yet.'}</p>
              <ul className="tick-list tick-list--green">
                {s.is_verified && <li><IconShield />GSTIN, PAN, bank, address and owner ID verified</li>}
              </ul>
              {trips[0] && <Link className="btn btn--primary btn--block" href={`/trips/${trips[0].slug}`}>Ask a question about a trip</Link>}
            </div>
            {reviews.length > 0 && <div className="panel"><h3>Seller rating</h3><RatingSummary rows={reviews} /></div>}
          </aside>
        </div>
      </div>
    </>
  )
}
