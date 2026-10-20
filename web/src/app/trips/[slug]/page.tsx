import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatPaise, nightsLabel } from '@/lib/format'
import type { PublicDeparture, PublicPackage } from '@/lib/types'
import { abs } from '@/lib/site'
import { JsonLd } from '@/components/JsonLd'
import { getCurrentUser } from '@/lib/auth'
import { StartChatButton } from '@/components/StartChatButton'

export const dynamic = 'force-dynamic'

async function load(slug: string) {
  const supabase = createClient()
  const { data } = await supabase.from('public_packages').select('*').eq('slug', slug).maybeSingle()
  return { supabase, pkg: data as PublicPackage | null }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { pkg } = await load(params.slug)
  if (!pkg) return { title: 'Trip not found', robots: { index: false } }
  const base = `${pkg.destination_name}, ${nightsLabel(pkg.nights, pkg.duration_days)}, from ${pkg.departure_city}. ${formatPaise(pkg.price_paise)} ${pkg.occupancy_basis ?? ''}`.trim()
  const description = (pkg.description ? `${pkg.description.slice(0, 120)} ` : '') + base
  return {
    title: pkg.title,
    description: description.slice(0, 300),
    alternates: { canonical: `/trips/${pkg.slug}` },
    openGraph: { title: pkg.title, description: description.slice(0, 200), url: abs(`/trips/${pkg.slug}`), type: 'website', images: pkg.photos[0] ? [{ url: pkg.photos[0] }] : undefined },
    twitter: { card: 'summary_large_image', title: pkg.title, images: pkg.photos[0] ? [pkg.photos[0]] : undefined },
  }
}

export default async function TripPage({ params }: { params: { slug: string } }) {
  const { supabase, pkg } = await load(params.slug)
  if (!pkg) notFound()
  const viewer = await getCurrentUser()

  const [{ data: deps }, { data: tiers }, { data: policy }, { data: reviews }] = await Promise.all([
    supabase.from('public_package_departures').select('*').eq('package_id', pkg.id).order('departure_date'),
    supabase.from('cancellation_policy_tiers').select('min_days_before, refund_pct').eq('code', pkg.cancellation_policy ?? '').order('min_days_before', { ascending: false }),
    supabase.from('cancellation_policy_codes').select('label, summary').eq('code', pkg.cancellation_policy ?? '').maybeSingle(),
    supabase.from('public_reviews').select('id, overall, matched_listing, comment, reviewer_first_name, created_at').eq('package_id', pkg.id).order('created_at', { ascending: false }).limit(10),
  ])
  const departures = (deps ?? []) as PublicDeparture[]
  const tierRows = (tiers ?? []) as { min_days_before: number; refund_pct: number }[]
  const itinerary = Array.isArray(pkg.itinerary) ? pkg.itinerary : []

  return (
    <div className="wrap page">
      <JsonLd data={[
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: pkg.title,
          description: pkg.description || undefined,
          image: pkg.photos.slice(0, 3),
          url: abs(`/trips/${pkg.slug}`),
          brand: { '@type': 'Organization', name: pkg.seller_name },
          offers: {
            '@type': 'Offer',
            url: abs(`/trips/${pkg.slug}`),
            priceCurrency: 'INR',
            price: (Number(pkg.price_paise) / 100).toFixed(2),
            availability: departures.length > 0 ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
            seller: { '@type': 'Organization', name: pkg.seller_name },
          },
          // only real, published reviews: never an invented rating
          ...(pkg.rating_avg !== null && pkg.review_count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(pkg.rating_avg).toFixed(1), reviewCount: pkg.review_count, bestRating: '5', worstRating: '1' } } : {}),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'ZoomFly', item: abs('/') },
            ...(pkg.destination_slug ? [{ '@type': 'ListItem', position: 2, name: pkg.destination_name, item: abs(`/destinations/${pkg.destination_slug}`) }] : []),
            { '@type': 'ListItem', position: pkg.destination_slug ? 3 : 2, name: pkg.title, item: abs(`/trips/${pkg.slug}`) },
          ],
        },
      ]} />
      <p className="small">
        <Link href="/">All trips</Link>
        {pkg.destination_slug && (
          <>
            {' / '}
            <Link href={`/destinations/${pkg.destination_slug}`}>{pkg.destination_name}</Link>
          </>
        )}
      </p>
      <div className="page__head">
        <h1>{pkg.title}</h1>
        <p className="muted">
          {pkg.destination_name}, {nightsLabel(pkg.nights, pkg.duration_days)}, from {pkg.departure_city}
        </p>
      </div>

      <div className="gallery">
        {pkg.photos.slice(0, 3).map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src + i} src={src} alt={`${pkg.title}, photo ${i + 1}`} />
        ))}
      </div>

      <div className="detail">
        <div>
          {pkg.description && <p>{pkg.description}</p>}

          <h2>Day by day</h2>
          {itinerary.length === 0 ? (
            <p className="muted">The seller has not added a day-by-day plan.</p>
          ) : (
            <div>
              {itinerary.map((d, i) => (
                <div key={i} className="day">
                  <div className="day__n">Day {d.day ?? i + 1}</div>
                  <div>
                    <strong>{d.title}</strong>
                    {d.description && <p style={{ margin: '4px 0 0' }}>{d.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="lists section">
            <div>
              <h3>What the price includes</h3>
              <ul className="plain-list">
                {pkg.inclusions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>What it does not include</h3>
              <ul className="plain-list">
                {pkg.exclusions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="section">
            <h2>Stay, food and travel</h2>
            <dl className="kv">
              {pkg.hotel_details && (<><dt>Stay</dt><dd>{pkg.hotel_details}</dd></>)}
              {pkg.meal_plan && (<><dt>Meals</dt><dd>{pkg.meal_plan}</dd></>)}
              {pkg.vehicle_type && (<><dt>Transport</dt><dd>{pkg.vehicle_type}</dd></>)}
              {pkg.pickup_point && (<><dt>Pickup</dt><dd>{pkg.pickup_point}</dd></>)}
              {pkg.drop_point && (<><dt>Drop</dt><dd>{pkg.drop_point}</dd></>)}
              {pkg.child_policy && (<><dt>Children</dt><dd>{pkg.child_policy}</dd></>)}
              {pkg.difficulty_level && (<><dt>Difficulty</dt><dd>{pkg.difficulty_level}</dd></>)}
              {pkg.high_risk_activities && (<><dt>Activity cover</dt><dd>{pkg.insurance_provided ? pkg.insurance_details || 'Insurance included' : 'Not included'}</dd></>)}
            </dl>
          </div>

          <div className="section">
            <h2>If you need to cancel</h2>
            <p>
              <strong>{policy?.label ?? pkg.cancellation_policy}</strong>
              {policy?.summary ? `: ${policy.summary}` : ''}
            </p>
            <ul className="plain-list">
              {tierRows.map((t) => (
                <li key={t.min_days_before}>
                  {t.min_days_before > 0 ? `${t.min_days_before} or more days before departure` : 'Closer to departure'}: {t.refund_pct}% refund
                </li>
              ))}
            </ul>
            <p className="muted small" style={{ marginTop: 12 }}>If the seller cancels, you get a full refund.</p>
          </div>

          <div className="section">
            <h2>Traveller reviews</h2>
            {(reviews ?? []).length === 0 ? (
              <p className="muted">No reviews yet. Only people who have completed this trip can review it.</p>
            ) : (
              (reviews ?? []).map((r: { id: string; overall: number; matched_listing: number; comment: string | null; reviewer_first_name: string; created_at: string }) => (
                <div key={r.id} className="day" style={{ gridTemplateColumns: '1fr' }}>
                  <div>
                    <strong>{r.reviewer_first_name}</strong>, rated {r.overall} of 5. The trip matched the listing: {r.matched_listing} of 5.
                    {r.comment && <p style={{ margin: '4px 0 0' }}>{r.comment}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="side panel" aria-label="Price and dates">
          <h2 style={{ marginBottom: 4 }}>{formatPaise(pkg.price_paise)}</h2>
          <p className="muted small" style={{ marginBottom: 14 }}>
            {pkg.occupancy_basis}, {pkg.price_includes_taxes ? 'taxes included' : 'taxes extra'}
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>{pkg.seller_name}</strong>
            {pkg.seller_city ? `, ${pkg.seller_city}` : ''}
          </p>
          {pkg.seller_verified && <p className="verified" style={{ marginBottom: 14 }}>Verified seller</p>}
          <div style={{ margin: '4px 0 6px' }}>
            {viewer ? <StartChatButton packageId={pkg.id} /> : <Link className="btn" href={`/login?next=/trips/${pkg.slug}`} style={{ display: 'block', textAlign: 'center' }}>Sign in to ask the seller a question</Link>}
          </div>
          <h3 style={{ marginTop: 18 }}>Book a date</h3>
          <form className="form" action="/book" method="get" style={{ gap: 12 }}>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="sr-only">Departure date</legend>
              {departures.map((d, i) => (
                <label key={d.id} className="check" style={{ padding: '6px 0' }}>
                  <input type="radio" name="departure" value={d.id} defaultChecked={i === 0} required />
                  <span>
                    {formatDate(d.departure_date, true)}
                    <span className={d.seats_left <= 4 ? 'seats seats--few' : 'seats'} style={{ display: 'block' }}>
                      {d.seats_left} {d.seats_left === 1 ? 'seat' : 'seats'} left, {formatPaise(d.price_paise)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="form__grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div className="field"><label htmlFor="adults">Adults</label><input id="adults" name="adults" type="number" min={1} max={20} defaultValue={2} /></div>
              <div className="field"><label htmlFor="children">Children</label><input id="children" name="children" type="number" min={0} max={20} defaultValue={0} /></div>
              <div className="field"><label htmlFor="infants">Infants</label><input id="infants" name="infants" type="number" min={0} max={10} defaultValue={0} /></div>
            </div>
            <button className="btn btn--primary" type="submit">Continue to book</button>
            <span className="field__hint">Infants travel without a seat. You pay a small advance now and the balance later.</span>
          </form>
        </aside>
      </div>
    </div>
  )
}
