import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { formatDate, formatPaise } from '@/lib/format'
import { BOOKING_LABEL, bookingPill } from '@/lib/booking'

export const metadata: Metadata = { title: 'Bookings', robots: { index: false } }
export const dynamic = 'force-dynamic'
const PAGE = 25
const STATUSES = ['pending_payment', 'confirmed', 'fully_paid', 'completed', 'cancelled_by_customer', 'cancelled_by_seller', 'cancelled_by_admin', 'expired']
const clean = (v: string | undefined) => (v ?? '').replace(/[,()*%\\"':]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)

export default async function AdminBookings({ searchParams }: { searchParams: { status?: string; q?: string; page?: string } }) {
  await requireAdmin('/admin/bookings')
  const status = STATUSES.includes(searchParams.status ?? '') ? searchParams.status! : ''
  const q = clean(searchParams.q)
  const page = Math.max(1, Math.min(500, Number(searchParams.page) || 1))
  const supabase = createClient()
  let query = supabase.from('bookings').select('id, booking_ref, package_title, departure_date, contact_name, contact_phone, status, total_paise, paid_paise, created_at', { count: 'exact' }).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (q) query = query.or(`booking_ref.ilike.%${q}%,contact_name.ilike.%${q}%,contact_phone.ilike.%${q}%,contact_email.ilike.%${q}%,package_title.ilike.%${q}%`)
  const { data, count } = await query.range((page - 1) * PAGE, page * PAGE - 1)
  const rows = (data ?? []) as { id: string; booking_ref: string; package_title: string; departure_date: string; contact_name: string; contact_phone: string; status: string; total_paise: number; paid_paise: number }[]
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE))
  const link = (over: Record<string, string>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ status, q, ...over })) if (v) p.set(k, v); return `/admin/bookings?${p}` }

  return (
    <div className="wrap page">
      <p className="small"><Link href="/admin">Admin</Link></p>
      <div className="page__head"><h1>Bookings</h1></div>
      <form className="form form--wide" action="/admin/bookings" style={{ marginBottom: 22 }}>
        <div className="form__grid">
          <div className="field"><label htmlFor="q">Find</label><input id="q" name="q" defaultValue={q} placeholder="Booking number, name, phone, email or trip" /></div>
          <div className="field"><label htmlFor="status">Status</label><select id="status" name="status" defaultValue={status}><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{BOOKING_LABEL[s]}</option>)}</select></div>
        </div>
        <div className="actions"><button className="btn btn--primary" type="submit">Search</button></div>
      </form>
      {rows.length === 0 ? <p className="panel">No bookings match.</p> : (
        <table className="table">
          <thead><tr><th>Booking</th><th>Customer</th><th>Leaves</th><th>Status</th><th>Paid</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/bookings/${r.id}`}><strong>{r.booking_ref}</strong></Link><br /><span className="muted small">{r.package_title}</span></td>
                <td>{r.contact_name}<br /><span className="muted small">{r.contact_phone}</span></td>
                <td>{formatDate(r.departure_date, true)}</td>
                <td><span className={bookingPill(r.status)}>{BOOKING_LABEL[r.status]}</span></td>
                <td>{formatPaise(r.paid_paise)} of {formatPaise(r.total_paise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pages > 1 && <nav className="actions" style={{ marginTop: 20, alignItems: 'center' }}>{page > 1 && <Link className="btn" href={link({ page: String(page - 1) })}>Previous</Link>}<span className="muted">Page {page} of {pages}</span>{page < pages && <Link className="btn" href={link({ page: String(page + 1) })}>Next</Link>}</nav>}
    </div>
  )
}
