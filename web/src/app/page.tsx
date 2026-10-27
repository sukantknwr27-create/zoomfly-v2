import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { formatPaise } from '@/lib/format'
import type { PublicDeparture, PublicDestination, PublicPackage } from '@/lib/types'
import { SITE_NAME, abs } from '@/lib/site'
import { JsonLd } from '@/components/JsonLd'
import { TripCard } from '@/components/TripCard'
import { IconCheck, IconSearch, IconSeat, IconShield, IconTag, IconWallet } from '@/components/Icons'

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

  // a real photo per destination, taken from the trips that are actually open there (no stock fallbacks)
  const photoByDest = new Map<string, string>()
  for (const p of packages) if (p.destination_slug && p.photos?.[0] && !photoByDest.has(p.destination_slug)) photoByDest.set(p.destination_slug, p.photos[0])
  const collage = packages.filter((p) => p.photos?.[0]).slice(0, 3)
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + i); return { v: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) } })

  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: abs('/'), description: 'A marketplace for tour packages from verified, GST-registered Indian operators.' }} />

      <section className="hero">
        <svg className="hero__contours" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M-20 420C150 360 260 470 430 410S720 300 900 360s250 40 340-30" />
          <path d="M-20 380C150 320 260 430 430 370S720 260 900 320s250 40 340-30" />
          <path d="M-20 340C150 280 260 390 430 330S720 220 900 280s250 40 340-30" />
          <path d="M-20 300C150 240 260 350 430 290S720 180 900 240s250 40 340-30" />
          <path d="M-20 260C150 200 260 310 430 250S720 140 900 200s250 40 340-30" />
          <path d="M-20 220C150 160 260 270 430 210S720 100 900 160s250 40 340-30" />
        </svg>
        <div className="wrap hero__grid">
          <div>
            <h1>Trips from tour operators we have checked.</h1>
            <p className="hero__lead">
              Every seller on ZoomFly is GST-registered and verified. Prices are all-in, dates are the seller&rsquo;s own, and the seat count is the seats actually left.
            </p>
          </div>
          {collage.length > 0 ? (
            <div className="collage" aria-label="Trips on ZoomFly">
              {collage.map((p) => (
                <Link key={p.id} href={`/trips/${p.slug}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.photos[0]} alt={`${p.title}, ${p.destination_name ?? ''}`} />
                  <span>{p.destination_name}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="hero__emptycard">
              <h2>Opening for bookings soon</h2>
              <p style={{ marginBottom: 0 }}>A trip goes live here only when a verified seller has published real dates with seats. Run tours? <Link href="/become-a-seller">List your trips</Link>.</p>
            </div>
          )}
        </div>
      </section>

      <div className="wrap finder">
        <form className="finder__bar" action="/trips" method="get" role="search">
          <div className="finder__cell">
            <label htmlFor="f-destination">Where to</label>
            <select id="f-destination" name="destination" defaultValue={slug}>
              <option value="">Any destination</option>
              {destinations.map((d) => <option key={d.id} value={d.slug}>{d.name} ({d.package_count})</option>)}
            </select>
          </div>
          <div className="finder__cell">
            <label htmlFor="f-month">Leaving in</label>
            <select id="f-month" name="month" defaultValue="">
              <option value="">Any month</option>
              {months.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
          </div>
          <div className="finder__cell">
            <label htmlFor="f-max">Budget per person</label>
            <select id="f-max" name="max" defaultValue="">
              <option value="">Any budget</option>
              <option value="10000">Up to ₹10,000</option>
              <option value="20000">Up to ₹20,000</option>
              <option value="35000">Up to ₹35,000</option>
              <option value="50000">Up to ₹50,000</option>
              <option value="100000">Up to ₹1,00,000</option>
            </select>
          </div>
          <button className="btn btn--gold" type="submit"><IconSearch />Find trips</button>
        </form>
      </div>

      <div className="wrap">
        <div className="assure" aria-label="Why book on ZoomFly">
          <div className="assure__item"><span className="assure__icon"><IconShield /></span><div><h3>Checked sellers</h3><p>GSTIN, PAN, bank account and owner ID verified before a first trip goes live.</p></div></div>
          <div className="assure__item"><span className="assure__icon"><IconSeat /></span><div><h3>Real seats</h3><p>The number you see is what is actually left, and it falls as people book.</p></div></div>
          <div className="assure__item"><span className="assure__icon"><IconTag /></span><div><h3>Prices you can compare</h3><p>Every price is per person, with taxes included or clearly marked extra.</p></div></div>
          <div className="assure__item"><span className="assure__icon"><IconWallet /></span><div><h3>You pay ZoomFly</h3><p>The seller is paid in stages as your trip approaches and after it ends.</p></div></div>
        </div>

        {leaving.length > 0 && !slug && (
          <section className="section" aria-label="Leaving soon">
            <div className="section__head"><div><h2>Leaving soon</h2><p className="muted">Open departures with seats left, soonest first.</p></div></div>
            <div className="leaving">
              {leaving.map((d) => {
                const p = byId.get(d.package_id)
                if (!p) return null
                const [, m, day] = d.departure_date.split('-')
                const month = new Date(Date.UTC(2000, Number(m) - 1, 1)).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })
                return (
                  <Link key={d.id} href={`/trips/${p.slug}`} className="leave">
                    <span className="date-block" aria-label={d.departure_date}>
                      <span className="date-block__day">{Number(day)}</span>
                      <span className="date-block__month">{month}</span>
                    </span>
                    <span>
                      <strong>{p.title}</strong>
                      <span className="muted small" style={{ display: 'block' }}>{p.destination_name}, from {p.departure_city}</span>
                      <span className="leave__price">{formatPaise(d.price_paise)} </span>
                      <span className={d.seats_left <= 4 ? 'seats seats--few' : 'seats'}>{d.seats_left} {d.seats_left === 1 ? 'seat' : 'seats'} left</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {destinations.length > 0 && !slug && (
          <section className="section" aria-label="Destinations">
            <div className="section__head">
              <div><h2>Where you can go</h2><p className="muted">Only places with a trip open for booking.</p></div>
              <Link className="link-more" href="/destinations">All destinations</Link>
            </div>
            <div className="tiles">
              {destinations.slice(0, destinations.length >= 4 ? Math.min(8, destinations.length - (destinations.length % 4)) : destinations.length).map((d) => (
                <Link key={d.id} href={`/destinations/${d.slug}`} className="tile">
                  {photoByDest.get(d.slug) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoByDest.get(d.slug)} alt="" loading="lazy" />
                  )}
                  <span className="tile__text"><strong>{d.name}</strong><span>{d.package_count} {d.package_count === 1 ? 'trip' : 'trips'}</span></span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="section" aria-label="Trips">
          <div className="section__head">
            <div><h2>{activeDest ? `Trips to ${activeDest.name}` : 'Trips you can book now'}</h2></div>
            <Link className="link-more" href="/trips">Search by price, length and date</Link>
          </div>
          {packages.length === 0 ? (
            <div className="panel empty">
              <p><strong>Nothing is open for booking{activeDest ? ` in ${activeDest.name}` : ''} yet.</strong></p>
              <p className="muted">Trips appear here as soon as a verified seller publishes dates with seats. {activeDest && <Link href="/">See all trips</Link>}</p>
            </div>
          ) : (
            <div className="cards">
              {packages.slice(0, 9).map((p) => <TripCard key={p.id} p={p} next={byPackage.get(p.id)} />)}
            </div>
          )}
        </section>

        <section className="section" aria-label="For tour operators">
          <div className="band">
            <div>
              <h2>Run tours? Reach travellers who are ready to book.</h2>
              <p>Registration is free. We earn a commission only when you get a booking, and you are paid in stages. All we ask is a GSTIN and a few documents so travellers can trust you.</p>
              <Link className="btn btn--gold" href="/become-a-seller">See what we need</Link>
            </div>
            <ul className="band__list">
              <li><IconCheck />No fee to register or list</li>
              <li><IconCheck />Travellers pay ZoomFly, and you are paid in stages</li>
              <li><IconCheck />Questions arrive through in-site chat, with phone numbers kept private until the trip is paid</li>
            </ul>
          </div>
        </section>
      </div>
    </>
  )
}
