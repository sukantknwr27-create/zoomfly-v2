import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { STATUS_LABEL, missingFields, statusPill } from '@/lib/packages'
import { formatDate, formatPaise } from '@/lib/format'
import type { DepartureRow, PackageRow, SellerRow } from '@/lib/types'
import { reviewPackage } from '../actions'

export const metadata: Metadata = { title: 'Review trip' }
export const dynamic = 'force-dynamic'

export default async function ReviewPackage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  await requireAdmin(`/admin/packages/${params.id}`)
  const supabase = createClient()
  const { data } = await supabase.from('packages').select('*').eq('id', params.id).maybeSingle()
  const p = data as PackageRow | null
  if (!p) notFound()
  const [{ data: sel }, { data: deps }, { data: rates }, { data: dest }] = await Promise.all([
    supabase.from('sellers').select('business_name, city, state, status, seller_tier, gstin_verified, pan_verified, bank_verified, address_verified, owner_id_verified, travel_registration_number').eq('id', p.seller_id).maybeSingle(),
    supabase.from('package_departures').select('*').eq('package_id', p.id).order('departure_date'),
    supabase.from('commission_rates').select('category, label, rate_pct').eq('is_active', true).order('rate_pct'),
    p.destination_id ? supabase.from('destinations').select('name').eq('id', p.destination_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const seller = sel as Pick<SellerRow, 'business_name' | 'city' | 'state' | 'status' | 'gstin_verified' | 'pan_verified' | 'bank_verified' | 'address_verified' | 'owner_id_verified' | 'travel_registration_number'> & { seller_tier: string } | null
  const departures = (deps ?? []) as DepartureRow[]
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const missing = missingFields(p, departures, today)
  const sellerReady = !!seller && seller.status === 'approved' && seller.gstin_verified && seller.pan_verified && seller.bank_verified && seller.address_verified && seller.owner_id_verified

  return (
    <div className="wrap page">
      <p className="small"><Link href="/admin/packages">All trip reviews</Link></p>
      <div className="page__head">
        <h1>{p.title}</h1>
        <div className="status-line">
          <span className={statusPill(p.listing_status)}>{STATUS_LABEL[p.listing_status]}</span>
          <span className="muted small">by {seller?.business_name}, {seller?.city}</span>
          {p.listing_status === 'published' && <Link href={`/trips/${p.slug}`}>Open the public page</Link>}
        </div>
      </div>
      {searchParams.error && <p className="notice notice--error" role="alert">{searchParams.error}</p>}
      {searchParams.ok && <p className="notice notice--ok" role="status">{searchParams.ok}</p>}
      {!sellerReady && <p className="notice notice--error">This seller is not fully verified or approved, so the trip cannot be published yet.</p>}
      {missing.length > 0 && <div className="notice notice--wait"><strong>Still missing:</strong> {missing.join('; ')}.</div>}

      <div className="lists" style={{ alignItems: 'start' }}>
        <div className="panel">
          <h2>The listing</h2>
          <dl className="kv">
            <dt>Destination</dt><dd>{dest?.name ?? 'Not set'}</dd>
            <dt>Leaves from</dt><dd>{p.departure_city}{p.pickup_point ? `, ${p.pickup_point}` : ''}</dd>
            <dt>Length</dt><dd>{p.duration_days} days, {p.nights} nights</dd>
            <dt>Price</dt><dd>{p.price_paise ? formatPaise(p.price_paise) : 'Not set'}, {p.occupancy_basis}, {p.price_includes_taxes ? 'taxes included' : 'taxes extra'}</dd>
            <dt>Stay</dt><dd>{p.hotel_details || 'Not given'}</dd>
            <dt>Meals</dt><dd>{p.meal_plan || 'Not given'}</dd>
            <dt>Transport</dt><dd>{p.vehicle_type || 'Not given'}</dd>
            <dt>Cancellation</dt><dd>{p.cancellation_policy || 'Not set'}</dd>
            <dt>Risk</dt><dd>{p.high_risk_activities ? `High-risk activities. Insurance: ${p.insurance_provided ? p.insurance_details || 'yes' : 'NOT provided'}` : 'No high-risk activities declared'}</dd>
          </dl>
          {p.description && <p style={{ marginTop: 16 }}>{p.description}</p>}
          <h3 style={{ marginTop: 20 }}>Plan</h3>
          <ol className="plain-list">{(p.itinerary ?? []).map((d, i) => <li key={i}><strong>{d.title}</strong>{d.description ? `: ${d.description}` : ''}</li>)}</ol>
          <h3>Included</h3><ul className="plain-list">{p.inclusions.map((x) => <li key={x}>{x}</li>)}</ul>
          <h3>Not included</h3><ul className="plain-list">{p.exclusions.map((x) => <li key={x}>{x}</li>)}</ul>
          <h3>Photos ({p.photos.length})</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {p.photos.map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="" style={{ width: 150, height: 100, objectFit: 'cover', borderRadius: 6 }} /></a>
            ))}
          </div>
          <h3 style={{ marginTop: 20 }}>Departures</h3>
          <ul className="dep-list">{departures.map((d) => <li key={d.id}><span>{formatDate(d.departure_date, true)}</span><span>{d.total_seats} seats, {d.status}</span></li>)}</ul>
        </div>

        <form className="panel form" action={reviewPackage}>
          <input type="hidden" name="id" value={p.id} />
          <h2>Your decision</h2>
          <div className="field">
            <label htmlFor="commission_category">Commission category</label>
            <select id="commission_category" name="commission_category" defaultValue={p.commission_category ?? ''}>
              <option value="">Choose one</option>
              {(rates ?? []).map((r: { category: string; label: string; rate_pct: number }) => <option key={r.category} value={r.category}>{r.label}, {Number(r.rate_pct)}%</option>)}
            </select>
            <span className="field__hint">You choose it, not the seller. The rate is fixed on this trip when you publish.</span>
          </div>
          <div className="field">
            <label htmlFor="review_note">Note to the seller</label>
            <textarea id="review_note" name="review_note" rows={4} defaultValue={p.review_note ?? ''} />
            <span className="field__hint">Required when you ask for changes or reject. The seller reads it.</span>
          </div>
          <div className="actions">
            <button className="btn btn--primary" type="submit" name="decision" value="publish">Publish</button>
            <button className="btn" type="submit" name="decision" value="changes">Ask for changes</button>
            <button className="btn btn--danger" type="submit" name="decision" value="reject">Reject</button>
            {p.listing_status === 'published' && <button className="btn" type="submit" name="decision" value="pause">Pause</button>}
          </div>
        </form>
      </div>
    </div>
  )
}
