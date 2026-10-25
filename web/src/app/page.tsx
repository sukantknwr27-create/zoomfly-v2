import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatPaise, nightsLabel } from '@/lib/format'
import type { PublicDeparture, PublicDestination, PublicPackage } from '@/lib/types'
import { SITE_NAME, abs } from '@/lib/site'
import { JsonLd } from '@/components/JsonLd'

export const dynamic = 'force-dynamic'

// A filtered view (?destination=manali) is the same content as /destinations/manali, so point search engines there.
export function generateMetadata({ searchParams }: { searchParams: { destination?: string } }): Metadata {
  const slug = searchParams.destination?.trim().toLowerCase()
  return { alternates: { canonical: slug ? `/destinations/${slug}` : '/' } }
}

export default async function Home({ searchParams }: { searchParams: { destination?: string } }) {
  const supabase = createClient()
  const slug = searchParams.destination?.trim().toLowerCase() || ''

  const { data: dests } = await supabase.from('public_destinations').select('id, slug, name, state, package_count').order('name')
  const destinations = (dests ?? []) as PublicDestination[]

  let q = supabase.from('public_packages').select('*').order('is_featured', { ascending: false }).order('next_departure_date', { ascending: true }).limit(40)
  if (slug) q = q.eq('destination_slug', slug)
  const { data: pk } = await q
  const packages = (pk ?? []) as PublicPackage[]

  // real, bookable departures only (the database view already hides closed / sold-out / past ones)
  const ids = packages.map((p) => p.id)
  const { data: deps } = ids.length
    ? await supabase.from('public_package_departures').select('*').in('package_id', ids).order('departure_date', { ascending: true })
    : { data: [] as PublicDeparture[] }
  const departures = (deps ?? []) as PublicDeparture[]
  const byPackage = new Map<string, PublicDeparture>()
  for (const d of departures) if (!byPackage.has(d.package_id)) byPackage.set(d.package_id, d)
  const leaving = departures.slice(0, 5)
  const byId = new Map(packages.map((p) => [p.id, p]))
  const activeDest = destinations.find((d) => d.slug === slug)

  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: abs('/'), description: 'A marketplace for tour packages from verified, GST-registered Indian operators.' }} />
      <section className="hero">
        <div className="wrap hero__grid">
          <div>
            <h1>Every trip here has a verified seller and real seats.</h1>
            <p className="hero__lead">
              We list tour packages only from GST-registered operators we have checked. Prices are all-in, departure dates are the seller&rsquo;s own, and the
              seat count is the seats actually left.
            </p>
            <form className="search" action="/trips" method="get">
              <label className="sr-only" htmlFor="destination" style={{ position: 'absolute', left: '-9999px' }}>
                Destination
              </label>
              <select id="destination" name="destination" defaultValue={slug}>
                <option value="">Any destination</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.slug}>
                    {d.name} ({d.package_count})
                  </option>
                ))}
              </select>
              <button className="btn btn--primary" type="submit">
                Find trips
              </button>
            </form>
          </div>

          <div className="board" aria-label="Next departures">
            <div className="board__title">Leaving soon</div>
            {leaving.length === 0 ? (
              <div className="board__empty">
                <p>
                  <strong>No departures are open yet.</strong>
                </p>
                <p className="muted small">
                  We open a trip for booking only when a verified seller has seats to sell, so this list stays empty until then. Run tours? <Link href="/become-a-seller">List your trips</Link>.
                </p>
              </div>
            ) : (
              leaving.map((d) => {
                const p = byId.get(d.package_id)
                if (!p) return null
                const [, m, day] = d.departure_date.split('-')
                const month = new Date(Date.UTC(2000, Number(m) - 1, 1)).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })
                return (
                  <Link key={d.id} href={`/trips/${p.slug}`} className="board__row">
                    <span className="date-block" aria-label={formatDate(d.departure_date, true)}>
                      <span className="date-block__day">{Number(day)}</span>
                      <span className="date-block__month">{month}</span>
                    </span>
                    <span className="board__what">
                      <strong>{p.title}</strong>
                      <span className="muted small">
                        {p.destination_name} from {p.departure_city}
                      </span>
                      <span className={d.seats_left <= 4 ? 'seats seats--few' : 'seats'}>
                        {d.seats_left} {d.seats_left === 1 ? 'seat' : 'seats'} left
                      </span>
                    </span>
                    <span className="board__price">{formatPaise(d.price_paise)}</span>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </section>

      <div className="wrap">
        {destinations.length > 0 && (
          <section className="section" aria-label="Destinations">
            <h2>Where you can go</h2>
            <ul className="chips">
              <li>
                <Link className="chip" href="/" aria-current={slug === '' ? 'true' : undefined}>
                  All
                </Link>
              </li>
              {destinations.map((d) => (
                <li key={d.id}>
                  <Link className="chip" href={`/destinations/${d.slug}`} aria-current={slug === d.slug ? 'true' : undefined}>
                    {d.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="section" aria-label="Trips">
          <h2>{activeDest ? `Trips to ${activeDest.name}` : 'Trips you can book now'}</h2>
          <p className="small"><Link href="/trips">Search all trips by price, length and date</Link></p>
          {packages.length === 0 ? (
            <div className="panel">
              <p>
                <strong>Nothing is open for booking{activeDest ? ` in ${activeDest.name}` : ''} yet.</strong>
              </p>
              <p className="muted">Trips appear here as soon as a verified seller publishes dates with seats. {activeDest && <Link href="/">See all trips</Link>}</p>
            </div>
          ) : (
            <div className="trip-list">
              {packages.map((p) => {
                const next = byPackage.get(p.id)
                return (
                  <Link key={p.id} href={`/trips/${p.slug}`} className="trip-row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="trip-row__photo" src={p.photos[0]} alt={`${p.title}, ${p.destination_name ?? ''}`} loading="lazy" />
                    <div>
                      <h3 className="trip-row__title">{p.title}</h3>
                      <div className="trip-row__meta">
                        {p.destination_name}, {nightsLabel(p.nights, p.duration_days)}, from {p.departure_city}
                      </div>
                      <div className="trip-row__meta">
                        {p.seller_name}
                        {p.seller_city ? `, ${p.seller_city}` : ''}{' '}
                        {p.seller_verified && <span className="verified">Verified seller</span>}
                      </div>
                      {p.rating_avg !== null && p.review_count > 0 && (
                        <div className="trip-row__meta">
                          Rated {Number(p.rating_avg).toFixed(1)} from {p.review_count} {p.review_count === 1 ? 'review' : 'reviews'}
                        </div>
                      )}
                    </div>
                    <div className="trip-row__price">
                      <b>{formatPaise(next?.price_paise ?? p.price_paise)}</b>
                      <span className="muted small">{p.occupancy_basis}</span>
                      {next && (
                        <span className={next.seats_left <= 4 ? 'seats seats--few' : 'seats'}>
                          Next: {formatDate(next.departure_date)}, {next.seats_left} left
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <section className="section" aria-label="Why book on ZoomFly">
          <h2>Why book here</h2>
          <div className="lists" style={{ gap: 32 }}>
            <ul className="plain-list" style={{ listStyle: 'none', padding: 0 }}>
              <li><strong>Sellers we have checked.</strong> Each shows a valid GSTIN, PAN, bank account and owner ID before their first trip goes live.</li>
              <li><strong>Real seats.</strong> The number you see is what is actually left, and it falls as people book.</li>
              <li><strong>Prices you can compare.</strong> Every price is per person, with taxes included or clearly marked extra.</li>
            </ul>
            <ul className="plain-list" style={{ listStyle: 'none', padding: 0 }}>
              <li><strong>You pay ZoomFly.</strong> The seller is paid in stages as your trip approaches and after it ends.</li>
              <li><strong>Private by default.</strong> Seller and traveller see each other&rsquo;s phone and email only once the trip is paid in full.</li>
              <li><strong>Clear cancellation.</strong> The policy is shown before you book, and a seller&rsquo;s cancellation always means a full refund.</li>
            </ul>
          </div>
          <p><Link href="/how-it-works">Read how ZoomFly works</Link></p>
        </section>

        <section className="section panel" aria-label="For tour operators">
          <h2>Run tours?</h2>
          <p>Registration is free. We earn a commission only when you get a booking, and you are paid in stages. All we ask is a GSTIN and a few documents so travellers can trust you.</p>
          <Link className="btn btn--primary" href="/become-a-seller">See what we need</Link>
        </section>
      </div>
    </>
  )
}
