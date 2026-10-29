import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { formatPaise } from '@/lib/format'
import { BarChart, HBars } from '@/components/Charts'
import { IconAlert, IconBag, IconChat, IconCompass, IconFile, IconLock, IconRupee, IconUsers, IconWallet } from '@/components/Icons'

export const metadata: Metadata = { title: 'Admin', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  await requireAdmin('/admin')
  const s = createClient()
  const head = (t: string) => s.from(t).select('*', { count: 'exact', head: true })
  const [sellers, trips, disputes, flags, failedMail, refunds, requests, payouts, stale] = await Promise.all([
    head('sellers').eq('status', 'pending'),
    head('packages').eq('listing_status', 'submitted'),
    head('disputes').neq('status', 'resolved'),
    head('messages').eq('flagged', true).gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()),
    head('email_outbox').eq('status', 'failed'),
    head('refunds').in('status', ['pending', 'failed']),
    head('data_requests').eq('status', 'open'),
    head('seller_payouts').eq('status', 'released'),
    head('bookings').eq('status', 'confirmed').lt('balance_due_on', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })),
  ])
  const tiles: [string, string, number | null, string][] = [
    ['/admin/sellers', 'Sellers waiting for review', sellers.count, 'Check documents and approve'],
    ['/admin/packages', 'Trips waiting for review', trips.count, 'Review and publish'],
    ['/admin/disputes', 'Open disputes', disputes.count, 'Reply within 2 days, settle in 7'],
    ['/admin/payouts', 'Payouts to transfer', payouts.count, 'Approved, waiting for your bank transfer'],
    ['/admin/bookings?status=confirmed', 'Balances overdue', stale.count, 'Confirmed bookings past their balance date'],
    ['/admin/flags', 'Flagged chats this week', flags.count, 'Contact details or payment hints in chat'],
    ['/admin/bookings', 'Refunds pending or failed', refunds.count, 'Open a booking to retry a failed refund'],
    ['/admin/privacy', 'Privacy requests', requests.count, 'Copy, correct or delete my data'],
    ['/admin/emails', 'Failed emails', failedMail.count, 'Retry after fixing the cause'],
  ]
  // ---- last 6 months of paid bookings (confirmed, fully paid or completed), month by Indian time
  const istMonth = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7)
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1)); return { key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }) } })
  const { data: bk } = await s.from('bookings').select('created_at, status, total_paise, commission_paise, seller_id, package_id').in('status', ['confirmed', 'fully_paid', 'completed']).gte('created_at', new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1) - 864e5).toISOString()).limit(20000)
  const paid = ((bk ?? []) as { created_at: string; total_paise: number; commission_paise: number; seller_id: string; package_id: string }[]).filter((b) => months.some((m) => m.key === istMonth(b.created_at)))
  const perMonth = months.map((m) => paid.filter((b) => istMonth(b.created_at) === m.key))
  const sumBy = (rows: { total_paise: number }[], k: 'total_paise' | 'commission_paise') => rows.reduce((a, r) => a + Number((r as never)[k] ?? 0), 0)
  const valueByMonth = perMonth.map((r) => sumBy(r, 'total_paise'))
  const commissionByMonth = perMonth.map((r) => sumBy(r, 'commission_paise'))
  const tally = (key: 'seller_id' | 'package_id') => { const m = new Map<string, number>(); for (const b of paid) m.set(b[key], (m.get(b[key]) ?? 0) + Number(b.total_paise)); return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5) }
  const topSellers = tally('seller_id')
  const topPackages = tally('package_id')
  const [{ data: sn }, { data: pn }] = await Promise.all([
    topSellers.length ? s.from('sellers').select('id, business_name').in('id', topSellers.map(([id]) => id)) : Promise.resolve({ data: [] }),
    topPackages.length ? s.from('packages').select('id, title, destination_id').in('id', topPackages.map(([id]) => id)) : Promise.resolve({ data: [] }),
  ])
  const sellerName = new Map(((sn ?? []) as { id: string; business_name: string }[]).map((r) => [r.id, r.business_name]))
  const pkgRows = (pn ?? []) as { id: string; title: string; destination_id: string | null }[]
  const destIds = Array.from(new Set(pkgRows.map((r) => r.destination_id).filter(Boolean))) as string[]
  const { data: dn } = destIds.length ? await s.from('destinations').select('id, name').in('id', destIds) : { data: [] }
  const destName = new Map(((dn ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]))
  const pkgDest = new Map(pkgRows.map((r) => [r.id, destName.get(r.destination_id ?? '') ?? 'Other']))
  const destTotals = new Map<string, number>(); for (const b of paid) { const d = pkgDest.get(b.package_id); if (d) destTotals.set(d, (destTotals.get(d) ?? 0) + Number(b.total_paise)) }
  const topDest = Array.from(destTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const fmtShort = (n: number) => (n >= 1e7 ? `₹${(n / 1e9).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e7).toFixed(1)}L` : formatPaise(n))
  const icons = [<IconUsers key="a" />, <IconCompass key="b" />, <IconAlert key="c" />, <IconRupee key="d" />, <IconWallet key="e" />, <IconChat key="f" />, <IconBag key="g" />, <IconLock key="h" />, <IconFile key="i" />]
  return (
    <div className="wrap page">
      <div className="page__head"><h1>Admin dashboard</h1><p className="muted" style={{ marginBottom: 0 }}>What needs your attention right now.</p></div>
      <div className="statgrid">
        {tiles.map(([href, label, n, hint], i) => (
          <Link key={href} href={href} className={`stat${n ? ' stat--warn' : ''}`}>
            <span className="stat__icon">{icons[i]}</span>
            <div><small>{label}</small><b>{n ?? 0}</b><span className="hint">{hint}</span></div>
          </Link>
        ))}
      </div>

      <h2 style={{ marginTop: 40 }}>Last 6 months</h2>
      <p className="muted small">Counts bookings that were confirmed, paid in full or completed, by the month they were made. Money figures are the booking price, before any later cancellation.</p>
      {paid.length === 0 ? (
        <div className="panel"><p className="muted" style={{ margin: 0 }}>No paid bookings in the last 6 months yet. Charts appear here as bookings come in.</p></div>
      ) : (
        <>
          <div className="cards-2">
            <div className="panel"><h3>Bookings per month</h3><BarChart label="Bookings per month" labels={months.map((m) => m.label)} values={perMonth.map((r) => r.length)} /></div>
            <div className="panel"><h3>Booking value per month</h3><BarChart label="Booking value per month" labels={months.map((m) => m.label)} values={valueByMonth} format={fmtShort} />
              <p className="small muted" style={{ margin: '8px 0 0' }}>ZoomFly commission over the 6 months: <strong>{formatPaise(commissionByMonth.reduce((a, b) => a + b, 0))}</strong></p></div>
          </div>
          <div className="cards-3" style={{ marginTop: 16 }}>
            <div className="panel"><h3>Top destinations</h3>{topDest.length ? <HBars rows={topDest.map(([label, value]) => ({ label, value }))} format={fmtShort} /> : <p className="muted">No data yet.</p>}</div>
            <div className="panel"><h3>Top sellers</h3><HBars rows={topSellers.map(([id, value]) => ({ label: sellerName.get(id) ?? 'Seller', value }))} format={fmtShort} /></div>
            <div className="panel"><h3>Top trips</h3><HBars rows={topPackages.map(([id, value]) => ({ label: pkgRows.find((r) => r.id === id)?.title ?? 'Trip', value }))} format={fmtShort} /></div>
          </div>
        </>
      )}
    </div>
  )
}
