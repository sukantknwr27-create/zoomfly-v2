import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatPaise, nightsLabel } from '@/lib/format'
import type { PublicDeparture, PublicDestination, PublicPackage } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Search trips',
  description: 'Search tour packages from verified Indian operators by destination, price, length and month.',
  alternates: { canonical: '/trips' },
}
export const dynamic = 'force-dynamic'

const PAGE = 12
type SP = { q?: string; destination?: string; min?: string; max?: string; days?: string; month?: string; sort?: string; page?: string }

// PostgREST treats , ( ) * % \ specially inside a filter, so strip them from free text before it goes anywhere near a query.
const cleanText = (v: string | undefined) => (v ?? '').replace(/[,()*%\\"':]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
const rupeesToPaise = (v: string | undefined) => {
  const n = Number((v ?? '').replace(/[,\s₹]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

export default async function Trips({ searchParams }: { searchParams: SP }) {
  const supabase = createClient()
  const q = cleanText(searchParams.q)
  const dest = (searchParams.destination ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '')
  const min = rupeesToPaise(searchParams.min), max = rupeesToPaise(searchParams.max)
  const days = ['short', 'week', 'long'].includes(searchParams.days ?? '') ? searchParams.days! : ''
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.month ?? '') ? searchParams.month! : ''
  const sort = ['soonest', 'price_asc', 'price_desc', 'rating'].includes(searchParams.sort ?? '') ? searchParams.sort! : 'soonest'
  const page = Math.max(1, Math.min(200, Number(searchParams.page) || 1))

  const { data: dests } = await supabase.from('public_destinations').select('id, slug, name').order('name')
  const destinations = (dests ?? []) as Pick<PublicDestination, 'id' | 'slug' | 'name'>[]

  // "Leaves in this month" means: some open departure falls in it
  let monthIds: string[] | null = null
  if (month) {
    const [y, m] = month.split('-').map(Number)
    const start = `${month}-01`, end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    const { data: md } = await supabase.from('public_package_departures').select('package_id').gte('departure_date', start).lte('departure_date', end).limit(2000)
    monthIds = Array.from(new Set((md ?? []).map((r: { package_id: string }) => r.package_id)))
  }

  let query = supabase.from('public_packages').select('*', { count: 'exact' })
  if (q) query = query.or(`title.ilike.%${q}%,destination_name.ilike.%${q}%,seller_name.ilike.%${q}%`)
  if (dest) query = query.eq('destination_slug', dest)
  if (min !== null) query = query.gte('price_paise', min)
  if (max !== null) query = query.lte('price_paise', max)
  if (days === 'short') query = query.lte('duration_days', 3)
  if (days === 'week') query = query.gte('duration_days', 4).lte('duration_days', 7)
  if (days === 'long') query = query.gte('duration_days', 8)
  if (monthIds) query = monthIds.length ? query.in('id', monthIds) : query.in('id', ['00000000-0000-0000-0000-000000000000'])
  query =
    sort === 'price_asc' ? query.order('price_paise', { ascending: true }) :
    sort === 'price_desc' ? query.order('price_paise', { ascending: false }) :
    sort === 'rating' ? query.order('rating_avg', { ascending: false, nullsFirst: false }).order('review_count', { ascending: false }) :
    query.order('next_departure_date', { ascending: true })
  const { data, count } = await query.range((page - 1) * PAGE, page * PAGE - 1)
  const trips = (data ?? []) as PublicPackage[]
  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE))

  const { data: deps } = trips.length ? await supabase.from('public_package_departures').select('*').in('package_id', trips.map((t) => t.id)).order('departure_date') : { data: [] }
  const next = new Map<string, PublicDeparture>()
  for (const d of (deps ?? []) as PublicDeparture[]) if (!next.has(d.package_id)) next.set(d.package_id, d)

  const params = (over: Record<string, string>) => {
    const p = new URLSearchParams()
    const cur: Record<string, string> = { q, destination: dest, min: searchParams.min ?? '', max: searchParams.max ?? '', days, month, sort }
    for (const [k, v] of Object.entries({ ...cur, ...over })) if (v) p.set(k, v)
    return `/trips?${p.toString()}`
  }
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + i); return { v: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) } })
  const anyFilter = Boolean(q || dest || min || max || days || month)

  return (
    <div className="wrap page">
      <div className="page__head"><h1>Search trips</h1><p className="muted">{total} {total === 1 ? 'trip' : 'trips'} open for booking{anyFilter ? ' with these filters' : ''}.</p></div>
      <form className="panel form form--wide" action="/trips" method="get" style={{ marginBottom: 28 }}>
        <div className="form__grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="field"><label htmlFor="q">Search</label><input id="q" name="q" defaultValue={q} placeholder="Place, trip or operator" /></div>
          <div className="field"><label htmlFor="destination">Destination</label>
            <select id="destination" name="destination" defaultValue={dest}><option value="">Anywhere</option>{destinations.map((d) => <option key={d.id} value={d.slug}>{d.name}</option>)}</select></div>
          <div className="field"><label htmlFor="month">Leaving in</label>
            <select id="month" name="month" defaultValue={month}><option value="">Any month</option>{months.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}</select></div>
          <div className="field"><label htmlFor="days">Length</label>
            <select id="days" name="days" defaultValue={days}><option value="">Any length</option><option value="short">Up to 3 days</option><option value="week">4 to 7 days</option><option value="long">8 days or more</option></select></div>
          <div className="field"><label htmlFor="min">Lowest price, ₹</label><input id="min" name="min" inputMode="numeric" defaultValue={searchParams.min ?? ''} /></div>
          <div className="field"><label htmlFor="max">Highest price, ₹</label><input id="max" name="max" inputMode="numeric" defaultValue={searchParams.max ?? ''} /></div>
          <div className="field"><label htmlFor="sort">Sort by</label>
            <select id="sort" name="sort" defaultValue={sort}><option value="soonest">Leaving soonest</option><option value="price_asc">Price, low to high</option><option value="price_desc">Price, high to low</option><option value="rating">Best rated</option></select></div>
        </div>
        <div className="actions"><button className="btn btn--primary" type="submit">Search</button>{anyFilter && <Link className="btn" href="/trips">Clear filters</Link>}</div>
      </form>

      {trips.length === 0 ? (
        <div className="panel"><p><strong>No trips match.</strong></p><p className="muted">{anyFilter ? 'Try a wider price range or another month, or clear the filters.' : 'Trips appear here as soon as a verified seller publishes dates with seats.'}</p></div>
      ) : (
        <div className="trip-list">
          {trips.map((p) => {
            const n = next.get(p.id)
            return (
              <Link key={p.id} href={`/trips/${p.slug}`} className="trip-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="trip-row__photo" src={p.photos[0]} alt={`${p.title}, ${p.destination_name ?? ''}`} loading="lazy" />
                <div>
                  <h2 className="trip-row__title" style={{ fontSize: '1.3rem' }}>{p.title}</h2>
                  <div className="trip-row__meta">{p.destination_name}, {nightsLabel(p.nights, p.duration_days)}, from {p.departure_city}</div>
                  <div className="trip-row__meta">{p.seller_name}{p.seller_city ? `, ${p.seller_city}` : ''} {p.seller_verified && <span className="verified">Verified seller</span>}</div>
                  {p.rating_avg !== null && p.review_count > 0 && <div className="trip-row__meta">Rated {Number(p.rating_avg).toFixed(1)} from {p.review_count} {p.review_count === 1 ? 'review' : 'reviews'}</div>}
                </div>
                <div className="trip-row__price"><b>{formatPaise(n?.price_paise ?? p.price_paise)}</b><span className="muted small">{p.occupancy_basis}</span>{n && <span className={n.seats_left <= 4 ? 'seats seats--few' : 'seats'}>Next: {formatDate(n.departure_date)}, {n.seats_left} left</span>}</div>
              </Link>
            )
          })}
        </div>
      )}

      {pages > 1 && (
        <nav className="actions" style={{ marginTop: 24, alignItems: 'center' }} aria-label="Pages">
          {page > 1 && <Link className="btn" href={params({ page: String(page - 1) })}>Previous</Link>}
          <span className="muted">Page {page} of {pages}</span>
          {page < pages && <Link className="btn" href={params({ page: String(page + 1) })}>Next</Link>}
        </nav>
      )}
    </div>
  )
}
