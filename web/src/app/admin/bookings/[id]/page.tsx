import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { formatDate, formatPaise } from '@/lib/format'
import { BOOKING_LABEL, bookingPill, refundPct } from '@/lib/booking'
import type { BookingRow } from '@/lib/payments'
import { AdminBookingActions } from '@/components/AdminBookingActions'

export const metadata: Metadata = { title: 'Booking', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function AdminBooking({ params }: { params: { id: string } }) {
  await requireAdmin(`/admin/bookings/${params.id}`)
  const supabase = createClient()
  const { data } = await supabase.from('bookings').select('*').eq('id', params.id).maybeSingle()
  const b = data as (BookingRow & { cancel_reason: string | null; terms_accepted_at: string | null; terms_version: string | null }) | null
  if (!b) notFound()
  const [{ data: pays }, { data: refunds }, { data: payouts }, { data: disputes }, { data: seller }] = await Promise.all([
    supabase.from('payments').select('id, kind, amount_paise, status, razorpay_payment_id, needs_review, created_at').eq('booking_id', b.id).order('created_at'),
    supabase.from('refunds').select('id, amount_paise, status, reason, razorpay_refund_id, created_at').eq('booking_id', b.id).order('created_at'),
    supabase.from('seller_payouts').select('id, milestone, amount_paise, due_on, status, utr').eq('booking_id', b.id).order('due_on'),
    supabase.from('disputes').select('id, status, reason').eq('booking_id', b.id),
    supabase.from('sellers').select('business_name, phone, email').eq('id', b.seller_id).maybeSingle(),
  ])
  const cancellable = ['pending_payment', 'confirmed', 'fully_paid'].includes(b.status)
  const policyPct = refundPct(b.cancellation_tiers ?? [], b.departure_date)

  return (
    <div className="wrap page">
      <p className="small"><Link href="/admin/bookings">All bookings</Link></p>
      <div className="page__head">
        <h1>{b.booking_ref}</h1>
        <div className="status-line"><span className={bookingPill(b.status)}>{BOOKING_LABEL[b.status]}</span><span className="muted small">{b.package_title}</span></div>
      </div>
      <div className="lists" style={{ alignItems: 'start' }}>
        <div className="panel">
          <h2>Booking</h2>
          <dl className="kv">
            <dt>Customer</dt><dd>{b.contact_name}, {b.contact_phone}{b.contact_email ? `, ${b.contact_email}` : ''}</dd>
            <dt>Seller</dt><dd>{seller?.business_name}, {seller?.phone}</dd>
            <dt>Leaves</dt><dd>{formatDate(b.departure_date, true)}, back {formatDate(b.trip_end_date, true)}</dd>
            <dt>Seats</dt><dd>{b.seats} ({(b.traveller_details ?? []).map((t) => t.name).filter(Boolean).join(', ')})</dd>
            <dt>Total</dt><dd>{formatPaise(b.total_paise)}, commission {formatPaise(b.commission_paise)}</dd>
            <dt>Paid</dt><dd>{formatPaise(b.paid_paise)}{b.balance_due_on ? `, balance due ${formatDate(b.balance_due_on, true)}` : ''}</dd>
            <dt>Cancellation policy</dt><dd>{b.cancellation_policy}{cancellable ? `, ${policyPct}% refund if cancelled today` : ''}</dd>
            <dt>Terms accepted</dt><dd>{b.terms_accepted_at ? `${formatDate(b.terms_accepted_at.slice(0, 10), true)} (version ${b.terms_version})` : 'No record'}</dd>
            {b.cancel_reason && (<><dt>Cancel reason</dt><dd>{b.cancel_reason}</dd></>)}
          </dl>
          {(disputes ?? []).length > 0 && <p style={{ marginTop: 14 }}><Link href="/admin/disputes">{(disputes ?? []).length} dispute{(disputes ?? []).length === 1 ? '' : 's'} on this booking</Link></p>}
        </div>
        <div className="panel">
          <h2>Money</h2>
          <h3>Payments</h3>
          {(pays ?? []).length === 0 ? <p className="muted">None.</p> : <ul className="dep-list">{(pays ?? []).map((p: { id: string; kind: string; amount_paise: number; status: string; razorpay_payment_id: string | null; needs_review: boolean; created_at: string }) => <li key={p.id}><span>{p.kind}, {formatDate(p.created_at.slice(0, 10), true)}<span className="muted small" style={{ display: 'block' }}>{p.razorpay_payment_id}{p.needs_review ? ', arrived after cancellation, refund queued' : ''}</span></span><strong>{formatPaise(p.amount_paise)}</strong></li>)}</ul>}
          <h3 style={{ marginTop: 16 }}>Refunds</h3>
          {(refunds ?? []).length === 0 ? <p className="muted">None.</p> : (
            <ul className="dep-list">
              {(refunds ?? []).map((r: { id: string; amount_paise: number; status: string; reason: string | null }) => (
                <li key={r.id}><span>{r.status}{r.reason ? `: ${r.reason}` : ''}{r.status === 'failed' && <AdminBookingActions mode="retry" refundId={r.id} />}</span><strong>{formatPaise(r.amount_paise)}</strong></li>
              ))}
            </ul>
          )}
          <h3 style={{ marginTop: 16 }}>Seller payouts</h3>
          {(payouts ?? []).length === 0 ? <p className="muted">None scheduled.</p> : <ul className="dep-list">{(payouts ?? []).map((p: { id: string; milestone: string; amount_paise: number; due_on: string; status: string; utr: string | null }) => <li key={p.id}><span>{p.milestone}, due {formatDate(p.due_on, true)}<span className="muted small" style={{ display: 'block' }}>{p.status}{p.utr ? `, ${p.utr}` : ''}</span></span><strong>{formatPaise(p.amount_paise)}</strong></li>)}</ul>}
        </div>
      </div>
      {cancellable && (
        <section className="section">
          <h2>Cancel this booking</h2>
          <p className="muted">Use this when a customer asks you to cancel for them, or a trip cannot run. The refund goes out with the next refund run, or at once if you use the button below the form.</p>
          <AdminBookingActions mode="cancel" bookingId={b.id} policyPct={policyPct} paidRupees={Math.floor(Number(b.paid_paise) / 100)} />
        </section>
      )}
    </div>
  )
}
