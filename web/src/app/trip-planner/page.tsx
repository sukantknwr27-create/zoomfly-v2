import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Banner } from '@/components/Banner'
import { TripRow } from '@/components/TripRow'
import { IconCheck, IconCompass } from '@/components/Icons'
import { formatPaise } from '@/lib/format'
import type { PublicDeparture, PublicDestination, PublicPackage } from '@/lib/types'

export const metadata: Metadata = { title: 'Trip planner', description: 'Tell us where, when and your budget. We match real open departures with seats for your group.', alternates: { canonical: '/trip-planner' } }
export const dynamic = 'force-dynamic'

type SP = { destination?: string; month?: string; days?: string; budget?: string; people?: string }
const BUDGETS = [['', 'Any budget'], ['10000', 'Up to ₹10,000'], ['20000', 'Up to ₹20,000'], ['35000', 'Up to ₹35,000'], ['50000', 'Up to ₹50,000'], ['100000', 'Up to ₹1,00,000']]
const LENGTHS = [['', 'Any length'], ['short', 'Up to 3 days'], ['week', '4 to 7 days'], ['long', '8 days or more']]

export default async function Planner({ searchParams }: { searchParams: SP }) {
  const supabase = createClient()
  const dest = (searchParams.destination ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '')
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.month ?? '') ? searchParams.month! : ''
  const days = ['short', 'week', 'long'].includes(searchParams.days ?? '') ? searchParams.days! : ''
  const budget = BUDGETS.some(([v]) => v && v === searchParams.budget) ? Number(searchParams.budget) : 0
  const people = Math.max(1, Math.min(20, Number(searchParams.people) || 2))
  const asked = Boolean(searchParams.people || dest || month || days || budget)

  const { data: dests } = await supabase.from('public_destinations').select('id, slug, name, package_count').order('name')
  const destinations = (dests ?? []) as Pick<PublicDestination, 'id' | 'slug' | 'name' | 'package_count'>[]
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + i); return { v: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) } })

  let matches: { p: PublicPackage; d: PublicDeparture }[] = []
  if (asked) {
    let q = supabase.from('public_packages').select('*')
    if (dest) q = q.eq('destination_slug', dest)
    if (budget) q = q.lte('price_paise', budget * 100)
    if (days === 'short') q = q.lte('duration_days', 3)
    if (days === 'week') q = q.gte('duration_days', 4).lte('duration_days', 7)
    if (days === 'long') q = q.gte('duration_days', 8)
    const { data } = await q.limit(100)
    const pkgs = (data ?? []) as PublicPackage[]
    if (pkgs.length) {
      let dq = supabase.from('public_package_departures').select('*').in('package_id', pkgs.map((p) => p.id)).gte('seats_left', people).order('departure_date')
      if (month) { const [y, m] = month.split('-').map(Number); dq = dq.gte('departure_date', `${month}-01`).lte('departure_date', new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)) }
      const { data: deps } = await dq.limit(2000)
      const first = new Map<string, PublicDeparture>()
      for (const d of (deps ?? []) as PublicDeparture[]) if (!first.has(d.package_id)) first.set(d.package_id, d)
      matches = pkgs.filter((p) => first.has(p.id)).map((p) => ({ p, d: first.get(p.id)! })).sort((a, b) => a.d.departure_date.localeCompare(b.d.departure_date)).slice(0, 8)
    }
  }

  return (
    <>
      <Banner title="Trip planner" sub="Tell us where, when and how many. We match real open departures that still have seats for your group." />
      <div className="wrap page">
        <form className="panel" action="/trip-planner" method="get" style={{ marginBottom: 32 }}>
          <div className="planner-form">
            <div className="field"><label htmlFor="pd">Where to</label><select id="pd" name="destination" defaultValue={dest}><option value="">Anywhere</option>{destinations.map((d) => <option key={d.id} value={d.slug}>{d.name}</option>)}</select></div>
            <div className="field"><label htmlFor="pm">Leaving in</label><select id="pm" name="month" defaultValue={month}><option value="">Any month</option>{months.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}</select></div>
            <div className="field"><label htmlFor="pp">Travellers</label><input id="pp" name="people" type="number" min={1} max={20} defaultValue={people} /></div>
            <div className="field"><label htmlFor="pb">Budget per person</label><select id="pb" name="budget" defaultValue={budget ? String(budget) : ''}>{BUDGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          </div>
          <div style={{ marginTop: 16 }}>
            <span className="field__label" style={{ display: 'block', marginBottom: 8 }}>Trip length</span>
            <div className="planner-pick">{LENGTHS.map(([v, l]) => <label key={v}><input type="radio" name="days" value={v} defaultChecked={days === v} /><span>{l}</span></label>)}</div>
          </div>
          <div className="actions" style={{ marginTop: 20 }}><button className="btn btn--primary" type="submit">Find my trips</button>{asked && <Link className="btn" href="/trip-planner">Start again</Link>}</div>
        </form>

        {asked && (
          <section aria-label="Matches">
            <h2>{matches.length > 0 ? `${matches.length} ${matches.length === 1 ? 'trip fits' : 'trips fit'} your plan` : 'No open departures fit yet'}</h2>
            {matches.length === 0 ? (
              <div className="panel empty"><IconCompass /><p><strong>Nothing has {people} {people === 1 ? 'seat' : 'seats'} free with those choices.</strong></p><p className="muted">Try another month, a wider budget or fewer travellers.</p><Link className="btn btn--primary" href="/trips">Browse all trips</Link></div>
            ) : (
              <div className="rows">
                {matches.map(({ p, d }) => <TripRow key={p.id} p={p} next={d} note={`${people} ${people === 1 ? 'traveller' : 'travellers'}: about ${formatPaise(d.price_paise * people)}`} />)}
              </div>
            )}
            <p className="muted small" style={{ marginTop: 16 }}>Estimates multiply the per-person price by the number of travellers. The exact total, including any extras, is shown before you pay.</p>
          </section>
        )}
        {!asked && (
          <div className="panel"><h3>How it works</h3>
            <ul className="tick-list"><li><IconCheck />Choose where, when, group size and budget</li><li><IconCheck />We only show departures with enough seats for your group</li><li><IconCheck />Open a trip to see the full plan and book</li></ul></div>
        )}
      </div>
    </>
  )
}
