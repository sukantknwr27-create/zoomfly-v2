import Link from 'next/link'
import { getSaved } from '@/lib/saved'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { TripRow } from '@/components/TripRow'
import { Banner } from '@/components/Banner'
import { IconCheck, IconCompass, IconSearch, IconSparkle } from '@/components/Icons'
import { ACTIVITY_TYPES } from '@/lib/activities'
import type { PublicDeparture, PublicDestination, PublicPackage } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Activities and experiences',
  description: 'Book day trips, adventure, sightseeing and food experiences from verified Indian operators.',
  alternates: { canonical: '/activities' },
}
export const dynamic = 'force-dynamic'

const PAGE = 12
type SP = { type?: string; hours?: string; q?: string; destination?: string; min?: string; max?: string; days?: string; month?: string; sort?: string; page?: string; rating?: string }

// PostgREST treats , ( ) * % \ specially inside a filter, so strip them from free text before it goes anywhere near a query.
const cleanText = (v: string | undefined) => (v ?? '').replace(/[,()*%\\"':]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
const rupeesToPaise = (v: string | undefined) => {
  const n = Number((v ?? '').replace(/[,\s₹]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

export default async function Activities({ searchParams }: { searchParams: SP }) {
  const supabase = createClient()
  const q = cleanText(searchParams.q)
  const dest = (searchParams.destination ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '')
  const min = rupeesToPaise(searchParams.min), max = rupeesToPaise(searchParams.max)
  const days = ['short', 'half', 'full'].includes(searchParams.hours ?? '') ? searchParams.hours! : ''
  const atype = ACTIVITY_TYPES.some(([k]) => k === searchParams.type) ? searchParams.type! : ''
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

  let query = supabase.from('public_packages').select('*', { count: 'exact' }).eq('kind', 'activity')
  if (q) query = query.or(`title.ilike.%${q}%,destination_name.ilike.%${q}%,seller_name.ilike.%${q}%`)
  if (dest) query = query.eq('destination_slug', dest)
  if (min !== null) query = query.gte('price_paise', min)
  if (max !== null) query = query.lte('price_paise', max)
  if (rating) query = query.gte('rating_avg', Number(rating))
  if (atype) query = query.eq('activity_type', atype)
  if (days === 'short') query = query.lte('duration_hours', 2)
  if (days === 'half') query = query.gt('duration_hours', 2).lte('duration_hours', 5)
  if (days === 'full') query = query.gt('duration_hours', 5)
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
    const cur: Record<string, string> = { q, destination: dest, min: searchParams.min ?? '', max: searchParams.max ?? '', hours: days, type: atype, month, sort, rating }
    for (const [k, v] of Object.entries({ ...cur, ...over })) if (v) p.set(k, v)
    return `/activities?${p.toString()}`
  }
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + i); return { v: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) } })
  const anyFilter = Boolean(q || dest || min || max || days || month || rating || atype)

  const { data: pk } = await supabase.from('public_packages').select('destination_slug, photos').eq('kind', 'activity').limit(300)
  const photoBy = new Map<string, string>()
  for (const r of (pk ?? []) as { destination_slug: string | null; photos: string[] }[]) if (r.destination_slug && r.photos?.[0] && !photoBy.has(r.destination_slug)) photoBy.set(r.destination_slug, r.photos[0])
    const RAT: [string, string][] = [['', 'Any rating'], ['4', '4.0 and above'], ['3.5', '3.5 and above']]

  const saved = await getSaved()
  const here = params({ page: String(page) })

  return (
    <>
      <Banner title="Activities and experiences" sub="Day trips, adventure, food and sightseeing from verified operators. Pick a date and a time slot.">
        <div className="finder__bar" role="search" style={{ gridTemplateColumns: '1fr auto', maxWidth: 720, marginTop: 8 }}>
          <div className="finder__cell" style={{ border: 0 }}>
            <label htmlFor="q" className="sr-only">Search</label>
            <input id="q" name="q" form="tf" defaultValue={q} placeholder="Search an activity, a place or an operator" style={{ border: 0, font: '600 1.05rem var(--body)', padding: '10px 0', width: '100%', color: 'var(--ink)', background: 'transparent' }} />
          </div>
          <button className="btn btn--primary" type="submit" form="tf" style={{ marginLeft: 8 }}><IconSearch />Search</button>
        </div>
      </Banner>

      <div className="wrap page results">
        <form id="tf" className="filters" action="/activities" method="get">
          <div className="filters__head"><h2>Filters</h2>{anyFilter && <Link href="/trips">Reset all</Link>}</div>
          <div className="field"><label htmlFor="sort">Sort by</label>
            <select id="sort" name="sort" defaultValue={sort}><option value="soonest">Soonest available</option><option value="price_asc">Price, low to high</option><option value="price_desc">Price, high to low</option><option value="rating">Best rated</option></select></div>
          <div className="field"><label htmlFor="destination">Destination</label>
            <select id="destination" name="destination" defaultValue={dest}><option value="">Anywhere</option>{destinations.map((d) => <option key={d.id} value={d.slug}>{d.name}</option>)}</select></div>
          <div className="field"><label htmlFor="month">Available in</label>
            <select id="month" name="month" defaultValue={month}><option value="">Any month</option>{months.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}</select></div>
          <div className="field"><label htmlFor="type">Type of activity</label>
            <select id="type" name="type" defaultValue={atype}><option value="">Any type</option>{ACTIVITY_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6, padding: 0 }}>How long</legend>
            {[['', 'Any length'], ['short', 'Up to 2 hours'], ['half', '2 to 5 hours'], ['full', 'More than 5 hours']].map(([v, l]) => <label key={v} className="opt"><input type="radio" name="hours" value={v} defaultChecked={days === v} />{l}</label>)}
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
            <h2>{q ? `Results for “${q}”` : 'Activities'} <span className="muted" style={{ fontWeight: 600, fontSize: '0.95rem' }}>({total} {total === 1 ? 'result' : 'results'})</span></h2>
          </div>
          {trips.length === 0 ? (
            <div className="panel empty">
              <IconCompass />
              <p><strong>No activities match.</strong></p>
              <p className="muted">{anyFilter ? 'Try a wider price range or another month, or reset the filters.' : 'Activities appear here as soon as a verified seller publishes slots with places.'}</p>
              <Link className="btn btn--primary" href="/trips">Browse holiday packages</Link>
            </div>
          ) : (
            <div className="rows">{trips.map((p) => <TripRow key={p.id} p={p} next={next.get(p.id)} saved={saved} here={here} />)}</div>
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
            <h2><IconSparkle className="" /> Why book activities here</h2>
            <ul className="tick-list">
              <li><IconCheck />Verified operators only</li>
              <li><IconCheck />Pick the date and start time</li>
              <li><IconCheck />Free cancellation up to 1 day before</li>
            </ul>
            <Link className="btn btn--block" href="/trust">How we protect you</Link>
          </div>
          {destinations.length > 0 && (
            <div className="panel">
              <h3>Popular searches</h3>
              <ul className="tags">{destinations.slice(0, 8).map((d) => <li key={d.id}><Link className="tag" href={`/activities?destination=${d.slug}`}>{d.name}</Link></li>)}</ul>
            </div>
          )}
          {false && (
            <div className="panel">
              <h3>Destinations</h3>
              <div className="mini-dest">
                {destinations.slice(0, 4).map((d) => (
                  <Link key={d.id} href={`/destinations/${d.slug}`}>
                    <span style={photoBy.get(d.slug) ? { backgroundImage: `url(${photoBy.get(d.slug)})` } : undefined} />
                    {d.name}
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
