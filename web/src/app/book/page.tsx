import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, requireUser } from '@/lib/auth'
import { formatDate, formatPaise } from '@/lib/format'
import { previewAmounts, type Settings } from '@/lib/booking'
import type { PublicDeparture, PublicPackage } from '@/lib/types'
import { BookingForm } from '@/components/BookingForm'
import { Steps } from '@/components/Steps'

export const metadata: Metadata = { title: 'Book your trip' }
export const dynamic = 'force-dynamic'

type SP = { departure?: string; adults?: string; children?: string; infants?: string }
const clamp = (v: string | undefined, min: number, max: number, d: number) => {
  const n = Number(v)
  return Number.isInteger(n) ? Math.min(Math.max(n, min), max) : d
}

export default async function Book({ searchParams }: { searchParams: SP }) {
  const qs = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => typeof v === 'string') as [string, string][]).toString()
  const user = await requireUser(`/book?${qs}`)
  const supabase = createClient()
  const { data: dep } = await supabase.from('public_package_departures').select('*').eq('id', searchParams.departure ?? '').maybeSingle()
  const departure = dep as PublicDeparture | null
  if (!departure) notFound()
  const [{ data: pk }, { data: st }, profile] = await Promise.all([
    supabase.from('public_packages').select('*').eq('id', departure.package_id).maybeSingle(),
    supabase.from('marketplace_settings').select('advance_pct, balance_due_days, seat_hold_minutes').maybeSingle(),
    getCurrentProfile(),
  ])
  const pkg = pk as PublicPackage | null
  const settings = st as Settings | null
  if (!pkg || !settings) notFound()

  const adults = clamp(searchParams.adults, 1, 20, 2)
  const children = clamp(searchParams.children, 0, 20, 0)
  const infants = clamp(searchParams.infants, 0, 10, 0)
  const seats = adults + children
  const amounts = previewAmounts(departure.price_paise, seats, departure.departure_date, settings)
  const enough = seats <= departure.seats_left

  return (
    <div className="wrap page">
      <Steps current={2} />
      <p className="small"><Link href={`/trips/${pkg.slug}`}>Back to the trip</Link></p>
      <div className="page__head">
        <h1>Book {pkg.title}</h1>
        <p className="muted">
          Leaves {formatDate(departure.departure_date, true)} from {pkg.departure_city}. {adults} {adults === 1 ? 'adult' : 'adults'}
          {children ? `, ${children} ${children === 1 ? 'child' : 'children'}` : ''}{infants ? `, ${infants} ${infants === 1 ? 'infant' : 'infants'}` : ''}.
        </p>
      </div>
      {!enough && <p className="notice notice--error">Only {departure.seats_left} {departure.seats_left === 1 ? 'seat is' : 'seats are'} left on this date. <Link href={`/trips/${pkg.slug}`}>Change the number of travellers</Link>.</p>}
      <div className="detail">
        <div>
          {enough && (
            <BookingForm departureId={departure.id} adults={adults} children={children} infants={infants}
              defaultName={profile?.full_name ?? ''} defaultEmail={user.email ?? ''} defaultPhone={profile?.phone ?? ''} />
          )}
        </div>
        <aside className="side panel" aria-label="Price">
          <h2 style={{ marginBottom: 4 }}>{formatPaise(amounts.total)}</h2>
          <p className="muted small" style={{ marginBottom: 14 }}>{formatPaise(departure.price_paise)} for each of {seats} {seats === 1 ? 'seat' : 'seats'}. {pkg.price_includes_taxes ? 'Taxes included.' : 'Taxes extra.'} Infants travel without a seat.</p>
          {amounts.payInFull ? (
            <p><strong>Pay {formatPaise(amounts.total)} now.</strong> This trip leaves soon, so the full amount is due when you book.</p>
          ) : (
            <>
              <p><strong>Pay {formatPaise(amounts.advance)} now</strong> to confirm your seats.</p>
              <p className="muted">The rest, {formatPaise(amounts.balance)}, is due {settings.balance_due_days} days before departure.</p>
            </>
          )}
          <p className="muted small">Your seats are held for {settings.seat_hold_minutes} minutes while you pay. The seller&rsquo;s contact details are shared once you have paid in full.</p>
        </aside>
      </div>
    </div>
  )
}
