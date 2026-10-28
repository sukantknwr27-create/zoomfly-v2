import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { formatDate, formatPaise } from '@/lib/format'
import { BOOKING_LABEL, bookingPill } from '@/lib/booking'
import { IconBag, IconCalendar, IconCheck, IconWallet } from '@/components/Icons'

export const metadata: Metadata = { title: 'Your bookings' }
export const dynamic = 'force-dynamic'

export default async function Bookings() {
  await requireUser('/bookings')
  const supabase = createClient()
  const { data } = await supabase.from('bookings').select('id, booking_ref, package_title, departure_date, seats, status, total_paise, paid_paise').order('created_at', { ascending: false })
  const rows = (data ?? []) as { id: string; booking_ref: string; package_title: string; departure_date: string; seats: number; status: string; total_paise: number; paid_paise: number }[]
  return (
    <div className="wrap page">
      <div className="page__head"><h1>Your bookings</h1></div>
      <div className="statgrid">
        <div className="stat"><span className="stat__icon"><IconBag /></span><div><small>All bookings</small><b>{rows.length}</b></div></div>
        <div className="stat stat--good"><span className="stat__icon"><IconCalendar /></span><div><small>Upcoming trips</small><b>{rows.filter((r) => ['confirmed', 'fully_paid'].includes(r.status)).length}</b></div></div>
        <div className="stat stat--warn"><span className="stat__icon"><IconWallet /></span><div><small>Waiting for payment</small><b>{rows.filter((r) => r.status === 'pending_payment').length}</b></div></div>
        <div className="stat"><span className="stat__icon"><IconCheck /></span><div><small>Completed</small><b>{rows.filter((r) => r.status === 'completed').length}</b></div></div>
      </div>
      {rows.length === 0 ? (
        <div className="panel"><p><strong>You have not booked a trip yet.</strong></p><p className="muted"><Link href="/">See trips you can book</Link></p></div>
      ) : (
        <table className="table">
          <thead><tr><th>Trip</th><th>Leaves</th><th>Status</th><th>Paid</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/bookings/${r.id}`}><strong>{r.package_title}</strong></Link><br /><span className="muted small">{r.booking_ref}, {r.seats} {r.seats === 1 ? 'seat' : 'seats'}</span></td>
                <td>{formatDate(r.departure_date, true)}</td>
                <td><span className={bookingPill(r.status)}>{BOOKING_LABEL[r.status]}</span></td>
                <td>{formatPaise(r.paid_paise)} of {formatPaise(r.total_paise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
