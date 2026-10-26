import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { formatDate, formatPaise } from '@/lib/format'
import { BOOKING_LABEL, bookingPill } from '@/lib/booking'
import { DisputeForm } from '@/components/DisputeForm'

export const metadata: Metadata = { title: 'Bookings' }
export const dynamic = 'force-dynamic'

type B = { id: string; booking_ref: string; package_title: string; departure_date: string; seats: number; status: string; total_paise: number; paid_paise: number; commission_paise: number; traveller_details: { name?: string }[] | null; contact_name: string | null; contact_phone: string | null }
type P = { id: string; milestone: string; amount_paise: number; due_on: string; status: string; hold_reason: string | null; booking_id: string }

const MS: Record<string, string> = { m1: 'First payout', m2: 'Second payout', m3: 'Final payout', cancellation_retained: 'Kept from a cancellation' }
const PS: Record<string, string> = { scheduled: 'Scheduled', on_hold: 'On hold', released: 'Approved, being transferred', paid: 'Paid', void: 'Cancelled' }

export default async function SellerBookings() {
  await requireUser('/seller/bookings')
  const supabase = createClient()
  const { data: seller } = await supabase.from('sellers').select('id').maybeSingle()
  if (!seller) redirect('/seller/apply')
  const [{ data: bk }, { data: po }, { data: dp }] = await Promise.all([
    supabase.from('seller_bookings').select('*').order('departure_date'),
    supabase.from('seller_payouts').select('id, milestone, amount_paise, due_on, status, hold_reason, booking_id').neq('status', 'void').order('due_on'),
    supabase.from('disputes').select('booking_id, status'),
  ])
  const dispute = new Map((dp ?? []).map((d: { booking_id: string; status: string }) => [d.booking_id, d.status]))
  const bookings = (bk ?? []) as B[]
  const payouts = (po ?? []) as P[]
  const refOf = new Map(bookings.map((b) => [b.id, b.booking_ref]))

  return (
    <div className="wrap page">
      <p className="small"><Link href="/seller">Seller area</Link></p>
      <div className="page__head"><h1>Bookings and payouts</h1></div>
      <h2>Bookings</h2>
      {bookings.length === 0 ? <p className="panel">No bookings yet.</p> : (
        <table className="table">
          <thead><tr><th>Trip</th><th>Leaves</th><th>Status</th><th>Travellers</th><th>Customer</th><th>Problem?</th></tr></thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.package_title}</strong><br /><span className="muted small">{b.booking_ref}, {b.seats} {b.seats === 1 ? 'seat' : 'seats'}</span></td>
                <td>{formatDate(b.departure_date, true)}</td>
                <td><span className={bookingPill(b.status)}>{BOOKING_LABEL[b.status]}</span><br /><span className="muted small">{formatPaise(b.paid_paise)} of {formatPaise(b.total_paise)} paid</span></td>
                <td>{b.traveller_details ? b.traveller_details.map((t) => t.name).filter(Boolean).join(', ') : <span className="muted">After the advance is paid</span>}</td>
                <td>{b.contact_phone ? <>{b.contact_name}<br />{b.contact_phone}</> : <span className="muted">Shared once paid in full</span>}</td>
                <td style={{ minWidth: 220 }}>
                  {['confirmed', 'fully_paid', 'completed'].includes(b.status) ? (
                    dispute.has(b.id) && dispute.get(b.id) !== 'resolved' ? <span className="pill pill--pending">Report open</span> : (
                      <details><summary style={{ cursor: 'pointer' }}>Report a problem</summary><div style={{ marginTop: 8 }}><DisputeForm bookingId={b.id} /></div></details>
                    )
                  ) : <span className="muted">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2 className="section">Payouts</h2>
      <p className="muted">You are paid in stages as a trip approaches and after it ends. ZoomFly&rsquo;s commission is already taken off these amounts. <a href="/api/seller/export/payouts">Download as a spreadsheet</a>.</p>
      {payouts.length === 0 ? <p className="panel">No payouts yet.</p> : (
        <table className="table">
          <thead><tr><th>Booking</th><th>Payout</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id}><td>{refOf.get(p.booking_id) ?? ''}</td><td>{MS[p.milestone]}</td><td>{formatPaise(p.amount_paise)}</td><td>{formatDate(p.due_on, true)}</td><td>{PS[p.status]}{p.hold_reason === 'dispute' ? ', a dispute is open' : ''}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
