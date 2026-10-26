import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { formatDate, formatPaise } from '@/lib/format'
import type { BookingRow } from '@/lib/payments'
import { PrintButton } from '@/components/PrintButton'

export const metadata: Metadata = { title: 'Payment receipt', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function Receipt({ params }: { params: { id: string } }) {
  await requireUser(`/bookings/${params.id}/receipt`)
  const supabase = createClient()
  const { data } = await supabase.from('bookings').select('*').eq('id', params.id).maybeSingle()
  const b = data as BookingRow | null
  if (!b || b.paid_paise <= 0) notFound()
  const [{ data: pays }, { data: refunds }, { data: seller }] = await Promise.all([
    supabase.from('payments').select('id, kind, amount_paise, created_at, razorpay_payment_id').eq('booking_id', b.id).eq('status', 'captured').order('created_at'),
    supabase.from('refunds').select('id, amount_paise, status, created_at').eq('booking_id', b.id).neq('status', 'failed').order('created_at'),
    supabase.from('public_sellers').select('business_name, city').eq('id', b.seller_id).maybeSingle(),
  ])
  const refunded = (refunds ?? []).reduce((n: number, r: { amount_paise: number }) => n + Number(r.amount_paise), 0)

  return (
    <div className="wrap page">
      <div className="panel" style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div><h1 style={{ marginBottom: 4 }}>Payment receipt</h1><p className="muted" style={{ margin: 0 }}>ZoomFly, booking {b.booking_ref}</p></div>
          <PrintButton />
        </div>
        <dl className="kv" style={{ marginTop: 22 }}>
          <dt>Traveller</dt><dd>{b.contact_name}</dd>
          <dt>Trip</dt><dd>{b.package_title}</dd>
          <dt>Operator</dt><dd>{seller?.business_name}{seller?.city ? `, ${seller.city}` : ''}</dd>
          <dt>Dates</dt><dd>{formatDate(b.departure_date, true)} to {formatDate(b.trip_end_date, true)}</dd>
          <dt>Seats</dt><dd>{b.seats}</dd>
          <dt>Trip total</dt><dd>{formatPaise(b.total_paise)}</dd>
        </dl>
        <h2 style={{ marginTop: 24 }}>Payments received</h2>
        <ul className="dep-list">
          {(pays ?? []).map((p: { id: string; kind: string; amount_paise: number; created_at: string; razorpay_payment_id: string | null }) => (
            <li key={p.id}><span>{p.kind === 'advance' ? 'Advance' : 'Balance'}, {formatDate(p.created_at.slice(0, 10), true)}<span className="muted small" style={{ display: 'block' }}>Reference {p.razorpay_payment_id}</span></span><strong>{formatPaise(p.amount_paise)}</strong></li>
          ))}
          <li><span>Total paid</span><strong>{formatPaise(b.paid_paise)}</strong></li>
          {refunded > 0 && <li><span>Refunded</span><strong>{formatPaise(refunded)}</strong></li>}
          {b.status === 'confirmed' && <li><span>Balance still due</span><strong>{formatPaise(Number(b.total_paise) - Number(b.paid_paise))}</strong></li>}
        </ul>
        <p className="muted small" style={{ marginTop: 20 }}>This is a payment receipt, not a GST tax invoice. All amounts are in Indian rupees.</p>
      </div>
    </div>
  )
}
