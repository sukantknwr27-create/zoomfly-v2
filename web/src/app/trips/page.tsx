import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { TripRow } from '@/components/TripRow'
import { Banner } from '@/components/Banner'
import { IconCheck, IconCompass, IconSearch, IconSparkle } from '@/components/Icons'
import type { PublicDeparture, PublicDestination, PublicPackage } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Search trips',
  description: 'Search tour packages from verified Indian operators by destination, price, length and month.',
  alternates: { canonical: '/trips' },
}
export const dynamic = 'force-dynamic'

const PAGE = 12
type SP = { q?: string; destination?: string; min?: string; max?: string; days?: string; month?: string; sort?: string; page?: string; rating?: string }

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
  const rating = ['4', '3.5'].includes(searchParams.rating ?? '') ? searchParams.rating! : ''
  const page = Math.max(1, Math.min(200, Number(searchParams.page) || 1))

  const { data: dests } = await supabase.from('public_destinations').select('id, slug, name, package_count').order('name')
  const destinations = (dests ?? []) as Pick<PublicDestination, 'id' | 'slug' | 'name' | 'package_count'>[]

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
  if (rating) query = query.gte('rating_avg', Number(rating))
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
    const cur: Record<string, string> = { q, destination: dest, min: searchParams.min ?? '', max: searchParams.max ?? '', days, month, sort, rating }
    for (const [k, v] of Object.entries({ ...cur, ...over })) if (v) p.set(k, v)
    return `/trips?${p.toString()}`
  }
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + i); return { v: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) } })
  const anyFilter = Boolean(q || dest || min || max || days || month || rating)

  const { data: pk } = await supabase.from('public_packages').select('destination_slug, photos').limit(300)
  const photoBy = new Map<string, string>()
  for (const r of (pk ?? []) as { destination_slug: string | null; photos: string[] }[]) if (r.destination_slug && r.photos?.[0] && !photoBy.has(r.destination_slug)) photoBy.set(r.destination_slug, r.photos[0])
  const DUR: [string, string][] = [['', 'Any length'], ['short', 'Up to 3 days'], ['week', '4 to 7 days'], ['long', '8 days or more']]
  const RAT: [string, string][] = [['', 'Any rating'], ['4', '4.0 and above'], ['3.5', '3.5 and above']]

  return (
    <>
      <Banner title="Find your holiday package" sub="Tours from verified operators, with real dates and seats left.">
        <div className="finder__bar" role="search" style={{ gridTemplateColumns: '1fr auto', maxWidth: 720, marginTop: 8 }}>
          <div className="finder__cell" style={{ border: 0 }}>
            <label htmlFor="q" className="sr-only">Search</label>
            <input id="q" name="q" form="tf" defaultValue={q} placeholder="Search a place, a trip or an operator" style={{ border: 0, font: '600 1.05rem var(--body)', padding: '10px 0', width: '100%', color: 'var(--ink)', background: 'transparent' }} />
          </div>
          <button className="btn btn--primary" type="submit" form="tf" style={{ marginLeft: 8 }}><IconSearch />Search</button>
        </div>
      </Banner>

      <div className="wrap page results">
        <form id="tf" className="filters" action="/trips" method="get">
          <div className="filters__head"><h2>Filters</h2>{anyFilter && <Link href="/trips">Reset all</Link>}</div>
          <div className="field"><label htmlFor="sort">Sort by</label>
            <select id="sort" name="sort" defaultValue={sort}><option value="soonest">Leaving soonest</option><option value="price_asc">Price, low to high</option><option value="price_desc">Price, high to low</option><option value="rating">Best rated</option></select></div>
          <div className="field"><label htmlFor="destination">Destination</label>
            <select id="destination" name="destination" defaultValue={dest}><option value="">Anywhere</option>{destinations.map((d) => <option key={d.id} value={d.slug}>{d.name} ({d.package_count})</option>)}</select></div>
          <div className="field"><label htmlFor="month">Leaving in</label>
            <select id="month" name="month" defaultValue={month}><option value="">Any month</option>{months.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}</select></div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6, padding: 0 }}>Duration</legend>
            {DUR.map(([v, l]) => <label key={v} className="opt"><input type="radio" name="days" value={v} defaultChecked={days === v} />{l}</label>)}
          </fieldset>
          <div>
            <h3>Price per person</h3>
            <div className="form__grid" style={{ gap: 10 }}>
              <div className="field"><label htmlFor="min" className="sr-only">Lowest price</label><input id="min" name="min" inputMode="numeric" placeholder="Min ₹" defaultValue={searchParams.min ?? ''} /></div>
              <div className="field"><label htmlFor="max" className="sr-only">Highest price</label><input id="max" name="max" inputMode="numeric" placeholder="Max ₹" defaultValue={searchParams.max ?? ''} /></div>
            </div>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6, padding: 0 }}>Traveller rating</legend>
            {RAT.map(([v, l]) => <label key={v} className="opt"><input type="radio" name="rating" value={v} defaultChecked={rating === v} />{l}</label>)}
          </fieldset>
          <button className="btn btn--primary btn--block" type="submit">Show trips</button>
        </form>

        <section aria-label="Results">
          <div className="sortbar">
            <h2>{q ? `Results for “${q}”` : 'Holiday packages'} <span className="muted" style={{ fontWeight: 600, fontSize: '0.95rem' }}>({total} {total === 1 ? 'result' : 'results'})</span></h2>
          </div>
          {trips.length === 0 ? (
            <div className="panel empty">
              <IconCompass />
              <p><strong>No trips match.</strong></p>
              <p className="muted">{anyFilter ? 'Try a wider price range or another month, or reset the filters.' : 'Trips appear here as soon as a verified seller publishes dates with seats.'}</p>
              <Link className="btn btn--primary" href="/trip-planner">Try the trip planner</Link>
            </div>
          ) : (
            <div className="rows">{trips.map((p) => <TripRow key={p.id} p={p} next={next.get(p.id)} />)}</div>
          )}
          {pages > 1 && (
            <nav className="actions" style={{ marginTop: 32, alignItems: 'center', justifyContent: 'center' }} aria-label="Pages">
              {page > 1 && <Link className="btn" href={params({ page: String(page - 1) })}>Previous</Link>}
              <span className="muted">Page {page} of {pages}</span>
              {page < pages && <Link className="btn" href={params({ page: String(page + 1) })}>Next</Link>}
            </nav>
          )}
        </section>

        <aside className="rail" aria-label="Help and ideas">
          <div className="panel">
            <h2><IconSparkle className="" /> Not sure where to go?</h2>
            <ul className="tick-list">
              <li><IconCheck />Tell us month, budget and group size</li>
              <li><IconCheck />We match real open departures</li>
              <li><IconCheck />See an estimated total before you book</li>
            </ul>
            <Link className="btn btn--block" href="/trip-planner">Open the trip planner</Link>
          </div>
          {destinations.length > 0 && (
            <div className="panel">
              <h3>Popular searches</h3>
              <ul className="tags">{destinations.slice(0, 8).map((d) => <li key={d.id}><Link className="tag" href={`/trips?destination=${d.slug}`}>{d.name}</Link></li>)}</ul>
            </div>
          )}
          {destinations.length > 1 && (
            <div className="panel">
              <h3>Destinations</h3>
              <div className="mini-dest">
                {destinations.slice(0, 4).map((d) => (
                  <Link key={d.id} href={`/destinations/${d.slug}`}>
                    <span style={photoBy.get(d.slug) ? { backgroundImage: `url(${photoBy.get(d.slug)})` } : undefined} />
                    {d.name}<small>{d.package_count} {d.package_count === 1 ? 'trip' : 'trips'}</small>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
