import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { formatDate, formatPaise } from '@/lib/format'
import { BOOKING_LABEL, bookingPill, refundPct } from '@/lib/booking'
import type { BookingRow } from '@/lib/payments'
import { PayButton } from '@/components/PayButton'
import { CancelButton } from '@/components/CancelButton'
import { ReviewForm } from '@/components/ReviewForm'
import { DisputeForm } from '@/components/DisputeForm'

export const metadata: Metadata = { title: 'Your booking' }
export const dynamic = 'force-dynamic'

type Contacts = { seller?: { business_name: string; phone: string; whatsapp: string | null; email: string } | null; note?: string } | null

export default async function BookingPage({ params }: { params: { id: string } }) {
  await requireUser(`/bookings/${params.id}`)
  const supabase = createClient()
  const { data } = await supabase.from('bookings').select('*').eq('id', params.id).maybeSingle()
  const b = data as BookingRow | null
  if (!b) notFound()
  const [{ data: pays }, { data: refunds }, { data: c }, { data: myReview }, { data: disputes }] = await Promise.all([
    supabase.from('payments').select('id, kind, amount_paise, created_at, needs_review').eq('booking_id', b.id).order('created_at'),
    supabase.from('refunds').select('id, amount_paise, status, created_at').eq('booking_id', b.id).order('created_at'),
    supabase.rpc('get_booking_contacts', { p_booking: b.id }),
    supabase.from('reviews').select('overall, matched_listing, value_for_money, comment').eq('booking_id', b.id).maybeSingle(),
    supabase.from('disputes').select('id, status, reason, resolution_note, resolved_refund_paise, resolution_due, created_at').eq('booking_id', b.id).order('created_at', { ascending: false }),
  ])
  const contacts = c as Contacts
  const holdLive = b.status === 'pending_payment' && b.hold_expires_at && new Date(b.hold_expires_at) > new Date()
  const holdLapsed = b.status === 'pending_payment' && !holdLive
  const balance = Number(b.total_paise) - Number(b.paid_paise)
  const cancellable = ['pending_payment', 'confirmed', 'fully_paid'].includes(b.status)
  const pct = refundPct(b.cancellation_tiers ?? [], b.departure_date)
  const refundIfCancelled = Math.floor((Number(b.paid_paise) * pct) / 100)
  const until = b.hold_expires_at ? new Date(b.hold_expires_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : ''

  return (
    <div className="wrap page">
      <p className="small"><Link href="/bookings">Your bookings</Link></p>
      <div className="page__head">
        <h1>{b.package_title}</h1>
        <div className="status-line">
          <span className={bookingPill(b.status)}>{BOOKING_LABEL[b.status]}</span>
          <span className="muted small">Booking {b.booking_ref}</span>
        </div>
      </div>

      {holdLive && (
        <div className="notice notice--wait">
          <strong>Your seats are held until {until}.</strong> Pay {formatPaise(Number(b.advance_paise) - Number(b.paid_paise))} to confirm them.
          <div style={{ marginTop: 12 }}><PayButton bookingId={b.id} kind="advance" label={`Pay ${formatPaise(Number(b.advance_paise) - Number(b.paid_paise))} now`} /></div>
        </div>
      )}
      {holdLapsed && <p className="notice notice--error">This seat hold has expired. <Link href="/">Find the trip again</Link> to book.</p>}
      {b.status === 'confirmed' && (
        <div className="notice notice--ok">
          <strong>Your seats are booked.</strong> The balance of {formatPaise(balance)} is due{b.balance_due_on ? ` by ${formatDate(b.balance_due_on, true)}` : ''}. We will send you a reminder.
          <div style={{ marginTop: 12 }}><PayButton bookingId={b.id} kind="balance" label={`Pay the balance, ${formatPaise(balance)}`} /></div>
        </div>
      )}
      {b.status === 'fully_paid' && <p className="notice notice--ok"><strong>Paid in full.</strong> Everything is set for your trip.</p>}
      {b.status === 'completed' && <p className="notice notice--ok">This trip is complete. We hope it went well.</p>}

      <div className="lists" style={{ alignItems: 'start' }}>
        <div className="panel">
          <h2>The trip</h2>
          <dl className="kv">
            <dt>Leaves</dt><dd>{formatDate(b.departure_date, true)}</dd>
            <dt>Back</dt><dd>{formatDate(b.trip_end_date, true)}</dd>
            <dt>Seats</dt><dd>{b.seats} ({b.adults} {b.adults === 1 ? 'adult' : 'adults'}{b.children ? `, ${b.children} ${b.children === 1 ? 'child' : 'children'}` : ''}{b.infants ? `, ${b.infants} ${b.infants === 1 ? 'infant' : 'infants'}` : ''})</dd>
            <dt>Travellers</dt><dd>{(b.traveller_details ?? []).map((t) => t.name).filter(Boolean).join(', ')}</dd>
            <dt>Total</dt><dd>{formatPaise(b.total_paise)}</dd>
            <dt>Paid</dt><dd>{formatPaise(b.paid_paise)}</dd>
          </dl>
          {contacts?.seller ? (
            <>
              <h3 style={{ marginTop: 20 }}>Your seller</h3>
              <p style={{ margin: 0 }}><strong>{contacts.seller.business_name}</strong><br />Phone {contacts.seller.phone}{contacts.seller.whatsapp ? `, WhatsApp ${contacts.seller.whatsapp}` : ''}<br />{contacts.seller.email}</p>
            </>
          ) : (
            <p className="muted small" style={{ marginTop: 16 }}>The seller&rsquo;s contact details appear here once you have paid in full.</p>
          )}
        </div>
        <div className="panel">
          <h2>Payments</h2>
          {(pays ?? []).length === 0 ? <p className="muted">No payments yet.</p> : (
            <ul className="dep-list">
              {(pays ?? []).map((p: { id: string; kind: string; amount_paise: number; created_at: string }) => (
                <li key={p.id}><span>{p.kind === 'advance' ? 'Advance' : 'Balance'}, {formatDate(p.created_at.slice(0, 10), true)}</span><strong>{formatPaise(p.amount_paise)}</strong></li>
              ))}
            </ul>
          )}
          {(refunds ?? []).length > 0 && (
            <>
              <h3 style={{ marginTop: 18 }}>Refunds</h3>
              <ul className="dep-list">
                {(refunds ?? []).map((r: { id: string; amount_paise: number; status: string }) => (
                  <li key={r.id}><span>{r.status === 'done' ? 'Sent to your payment method' : 'Being processed'}</span><strong>{formatPaise(r.amount_paise)}</strong></li>
                ))}
              </ul>
              <p className="muted small">Refunds reach your account in 5 to 7 working days.</p>
            </>
          )}
          {cancellable && b.status !== 'pending_payment' && (
            <div style={{ marginTop: 22 }}>
              <h3>Need to cancel?</h3>
              <p className="muted small">
                {pct > 0 ? `If you cancel today you get ${pct}% of what you have paid back, ${formatPaise(refundIfCancelled)}.` : 'If you cancel today, nothing is refunded under this trip’s cancellation policy.'} If the seller cancels, you always get a full refund.
              </p>
              <CancelButton bookingId={b.id} summary={pct > 0 ? `You will be refunded ${formatPaise(refundIfCancelled)}.` : 'You will not be refunded.'} />
            </div>
          )}
        </div>
      </div>

      {b.status === 'completed' && (
        <section className="section">
          <h2>Your review</h2>
          {myReview ? (
            <div className="panel"><p style={{ margin: 0 }}>You rated this trip {myReview.overall} of 5, and said it matched the listing {myReview.matched_listing} of 5. Thank you.{myReview.comment ? ` “${myReview.comment}”` : ''}</p></div>
          ) : (
            <><p className="muted">How was it? Your review helps other travellers and shows how honest the listing was.</p><ReviewForm bookingId={b.id} /></>
          )}
        </section>
      )}

      {['confirmed', 'fully_paid', 'completed', 'cancelled_by_customer', 'cancelled_by_seller', 'cancelled_by_admin'].includes(b.status) && (
        <section className="section">
          <h2>Something wrong?</h2>
          {(disputes ?? []).map((d: { id: string; status: string; reason: string; resolution_note: string | null; resolved_refund_paise: number | null; resolution_due: string }) => (
            <div key={d.id} className="panel" style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 6px' }}><span className={d.status === 'resolved' ? 'pill pill--approved' : 'pill pill--pending'}>{d.status === 'resolved' ? 'Resolved' : d.status === 'under_review' ? 'We are looking into it' : 'Received'}</span></p>
              <p style={{ margin: '0 0 6px', whiteSpace: 'pre-wrap' }}>{d.reason}</p>
              {d.status === 'resolved' ? <p style={{ margin: 0 }}><strong>Our decision:</strong> {d.resolution_note}{d.resolved_refund_paise ? ` You are being refunded ${formatPaise(d.resolved_refund_paise)}.` : ''}</p> : <p className="muted small" style={{ margin: 0 }}>We aim to settle this by {formatDate(d.resolution_due.slice(0, 10), true)}.</p>}
            </div>
          ))}
          {!(disputes ?? []).some((d: { status: string }) => d.status !== 'resolved') && <DisputeForm bookingId={b.id} />}
        </section>
      )}
    </div>
  )
}
