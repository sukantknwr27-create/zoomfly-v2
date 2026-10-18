import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatPaise, nightsLabel } from '@/lib/format'
import type { PublicDeparture, PublicPackage } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function load(slug: string) {
  const supabase = createClient()
  const { data } = await supabase.from('public_packages').select('*').eq('slug', slug).maybeSingle()
  return { supabase, pkg: data as PublicPackage | null }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { pkg } = await load(params.slug)
  if (!pkg) return { title: 'Trip not found' }
  return { title: pkg.title, description: `${pkg.title}: ${pkg.destination_name}, ${nightsLabel(pkg.nights, pkg.duration_days)}, from ${formatPaise(pkg.price_paise)} ${pkg.occupancy_basis ?? ''}`.trim() }
}

export default async function TripPage({ params }: { params: { slug: string } }) {
  const { supabase, pkg } = await load(params.slug)
  if (!pkg) notFound()

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
      <p className="small">
        <Link href="/">All trips</Link>
        {pkg.destination_slug && (
          <>
            {' / '}
            <Link href={`/?destination=${pkg.destination_slug}`}>{pkg.destination_name}</Link>
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
          <h3 style={{ marginTop: 18 }}>Open departures</h3>
          <ul className="dep-list">
            {departures.map((d) => (
              <li key={d.id}>
                <span>{formatDate(d.departure_date, true)}</span>
                <span className={d.seats_left <= 4 ? 'seats seats--few' : 'seats'}>
                  {d.seats_left} {d.seats_left === 1 ? 'seat' : 'seats'} left
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
