import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { formatPaise } from '@/lib/format'

export const metadata: Metadata = { title: 'Money overview', robots: { index: false } }
export const dynamic = 'force-dynamic'
const day = /^\d{4}-\d{2}-\d{2}$/

type Sum = { bookings_created: number; booking_value_paise: number; commission_paise: number; collected_paise: number; refunds_paise: number; refunds_pending_paise: number; payouts_paid_paise: number; payouts_due_paise: number; seller_deductions_paise: number }

export default async function Finance({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  await requireAdmin('/admin/finance')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const from = day.test(searchParams.from ?? '') ? searchParams.from! : today.slice(0, 8) + '01'
  const to = day.test(searchParams.to ?? '') ? searchParams.to! : today
  const supabase = createClient()
  const { data } = await supabase.rpc('finance_summary', { p_from: from, p_to: to })
  const s = (data ?? {}) as Sum
  const qs = `from=${from}&to=${to}`
  const rows: [string, number | string, string][] = [
    ['Bookings made', s.bookings_created ?? 0, 'Confirmed or paid in the period'],
    ['Value of those bookings', formatPaise(s.booking_value_paise), 'Total price, before any cancellations'],
    ['ZoomFly commission on them', formatPaise(s.commission_paise), 'Before GST. Ask your CA about GST on commission'],
    ['Money received from customers', formatPaise(s.collected_paise), 'Captured payments in the period'],
    ['Refunds created', formatPaise(s.refunds_paise), 'Includes refunds not yet sent'],
    ['Refunds waiting or failed (all time)', formatPaise(s.refunds_pending_paise), 'Money still owed back to customers'],
    ['Paid out to sellers', formatPaise(s.payouts_paid_paise), 'Transfers you marked as paid in the period'],
    ['Still to pay sellers (all time)', formatPaise(s.payouts_due_paise), 'Scheduled, approved or on hold'],
    ['Deductions to take off sellers (all time)', formatPaise(s.seller_deductions_paise), 'From dispute refunds and clawbacks'],
  ]
  return (
    <div className="wrap page">
      <p className="small"><Link href="/admin">Admin</Link></p>
      <div className="page__head"><h1>Money overview</h1></div>
      <form className="form form--wide" action="/admin/finance" style={{ marginBottom: 24 }}>
        <div className="form__grid">
          <div className="field"><label htmlFor="from">From</label><input id="from" name="from" type="date" defaultValue={from} /></div>
          <div className="field"><label htmlFor="to">To</label><input id="to" name="to" type="date" defaultValue={to} /></div>
        </div>
        <div className="actions"><button className="btn btn--primary" type="submit">Show</button></div>
      </form>
      <table className="table">
        <tbody>{rows.map(([label, value, hint]) => <tr key={label}><td><strong>{label}</strong><div className="muted small">{hint}</div></td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><strong>{value}</strong></td></tr>)}</tbody>
      </table>
      <h2 className="section">Spreadsheets for your accountant</h2>
      <p className="muted">One row per record, for the dates above. They open in Excel or Google Sheets.</p>
      <ul className="chips">{['bookings', 'payments', 'refunds', 'payouts'].map((k) => <li key={k}><a className="chip" href={`/api/admin/export/${k}?${qs}`}>{k[0].toUpperCase() + k.slice(1)} (CSV)</a></li>)}</ul>
    </div>
  )
}
