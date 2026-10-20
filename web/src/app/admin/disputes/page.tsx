import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { formatPaise } from '@/lib/format'
import { AdminDisputeActions } from '@/components/AdminDisputeActions'

export const metadata: Metadata = { title: 'Disputes' }
export const dynamic = 'force-dynamic'

type D = { id: string; reason: string; status: string; opened_by_role: string; first_response_due: string; resolution_due: string; first_responded_at: string | null; resolution_note: string | null; resolved_refund_paise: number | null; created_at: string; bookings: { booking_ref: string; package_title: string; paid_paise: number; total_paise: number; contact_name: string; contact_phone: string; sellers: { business_name: string } | { business_name: string }[] | null } | null }
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)
const when = (s: string) => new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })

export default async function Disputes({ searchParams }: { searchParams: { show?: string } }) {
  await requireAdmin('/admin/disputes')
  const showResolved = searchParams.show === 'resolved'
  const supabase = createClient()
  let q = supabase.from('disputes').select('id, reason, status, opened_by_role, first_response_due, resolution_due, first_responded_at, resolution_note, resolved_refund_paise, created_at, bookings(booking_ref, package_title, paid_paise, total_paise, contact_name, contact_phone, sellers(business_name))').order('resolution_due').limit(100)
  q = showResolved ? q.eq('status', 'resolved') : q.neq('status', 'resolved')
  const { data } = await q
  const rows = (data ?? []) as unknown as D[]
  const now = Date.now()

  return (
    <div className="wrap page">
      <div className="page__head">
        <h1>Disputes</h1>
        <ul className="chips" style={{ marginTop: 14 }}>
          <li><a className="chip" href="/admin/disputes" aria-current={!showResolved ? 'true' : undefined}>Open</a></li>
          <li><a className="chip" href="/admin/disputes?show=resolved" aria-current={showResolved ? 'true' : undefined}>Resolved</a></li>
        </ul>
      </div>
      {rows.length === 0 ? <p className="panel">Nothing here.</p> : rows.map((d) => {
        const bk = d.bookings
        const seller = bk ? one(bk.sellers) : null
        const late = d.status !== 'resolved' && new Date(d.resolution_due).getTime() < now
        return (
          <div key={d.id} className="panel" style={{ marginBottom: 20 }}>
            <div className="status-line">
              <strong>{bk?.package_title}</strong>
              <span className={d.status === 'resolved' ? 'pill pill--approved' : late ? 'pill pill--bad' : 'pill pill--pending'}>{d.status === 'under_review' ? 'under review' : d.status}{late ? ', overdue' : ''}</span>
              <span className="muted small">{bk?.booking_ref}, seller {seller?.business_name}</span>
            </div>
            <p style={{ whiteSpace: 'pre-wrap' }}><span className="muted small">Raised by the {d.opened_by_role}:</span><br />{d.reason}</p>
            <p className="muted small">Reply by {when(d.first_response_due)}. Resolve by {when(d.resolution_due)}. Customer {bk?.contact_name}, {bk?.contact_phone}. Paid {bk ? formatPaise(bk.paid_paise) : ''} of {bk ? formatPaise(bk.total_paise) : ''}.</p>
            {d.status === 'resolved' ? (
              <p><strong>Resolution:</strong> {d.resolution_note}{d.resolved_refund_paise ? ` Refund: ${formatPaise(d.resolved_refund_paise)}.` : ''}</p>
            ) : (
              <AdminDisputeActions id={d.id} status={d.status} maxRefundRupees={Math.floor((bk?.paid_paise ?? 0) / 100)} />
            )}
          </div>
        )
      })}
    </div>
  )
}
