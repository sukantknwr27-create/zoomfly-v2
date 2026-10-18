import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { formatDate, formatPaise } from '@/lib/format'
import { markPaid } from './actions'

export const metadata: Metadata = { title: 'Payouts' }
export const dynamic = 'force-dynamic'

type Row = { id: string; milestone: string; amount_paise: number; due_on: string; status: string; utr: string | null; bookings: { booking_ref: string } | { booking_ref: string }[] | null; sellers: { business_name: string; bank_account_name: string | null; bank_account_number: string | null; bank_ifsc: string | null; bank_name: string | null } | { business_name: string; bank_account_name: string | null; bank_account_number: string | null; bank_ifsc: string | null; bank_name: string | null }[] | null }
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)

export default async function AdminPayouts({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  await requireAdmin('/admin/payouts')
  const supabase = createClient()
  const { data } = await supabase
    .from('seller_payouts')
    .select('id, milestone, amount_paise, due_on, status, utr, bookings(booking_ref), sellers(business_name, bank_account_name, bank_account_number, bank_ifsc, bank_name)')
    .in('status', ['released', 'scheduled', 'on_hold'])
    .order('due_on')
    .limit(200)
  const rows = (data ?? []) as unknown as Row[]
  const toPay = rows.filter((r) => r.status === 'released')
  const upcoming = rows.filter((r) => r.status !== 'released')

  return (
    <div className="wrap page">
      <div className="page__head"><h1>Seller payouts</h1><p className="muted">Transfer each approved payout from your bank, then enter the bank reference (UTR) to close it.</p></div>
      {searchParams.error && <p className="notice notice--error" role="alert">{searchParams.error}</p>}
      {searchParams.ok && <p className="notice notice--ok" role="status">{searchParams.ok}</p>}
      <h2>Ready to transfer</h2>
      {toPay.length === 0 ? <p className="panel">Nothing is waiting.</p> : (
        <table className="table">
          <thead><tr><th>Seller and bank</th><th>Booking</th><th>Amount</th><th>Mark paid</th></tr></thead>
          <tbody>
            {toPay.map((r) => {
              const s = one(r.sellers)
              return (
                <tr key={r.id}>
                  <td><strong>{s?.business_name}</strong><br /><span className="small">{s?.bank_account_name}, {s?.bank_name}<br />A/c {s?.bank_account_number}, IFSC {s?.bank_ifsc}</span></td>
                  <td>{one(r.bookings)?.booking_ref}<br /><span className="muted small">{r.milestone}</span></td>
                  <td><strong>{formatPaise(r.amount_paise)}</strong></td>
                  <td>
                    <form action={markPaid} className="form" style={{ gap: 6 }}>
                      <input type="hidden" name="id" value={r.id} />
                      <input name="utr" placeholder="Bank reference (UTR)" aria-label="Bank reference" required style={{ font: 'inherit', padding: '6px 8px', border: '1.5px solid var(--line)', borderRadius: 6 }} />
                      <button className="btn btn--primary" type="submit" style={{ padding: '4px 12px', fontSize: '0.9rem' }}>Mark paid</button>
                    </form>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <h2 className="section">Coming up</h2>
      {upcoming.length === 0 ? <p className="panel">Nothing scheduled.</p> : (
        <table className="table">
          <thead><tr><th>Seller</th><th>Booking</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>
            {upcoming.map((r) => (
              <tr key={r.id}><td>{one(r.sellers)?.business_name}</td><td>{one(r.bookings)?.booking_ref}<br /><span className="muted small">{r.milestone}</span></td><td>{formatPaise(r.amount_paise)}</td><td>{formatDate(r.due_on, true)}</td><td>{r.status === 'on_hold' ? 'On hold (dispute)' : 'Scheduled'}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
