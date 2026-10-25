import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

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
  return (
    <div className="wrap page">
      <div className="page__head"><h1>Admin</h1></div>
      <div className="trip-list" style={{ background: 'transparent', border: 0, gap: 12 }}>
        {tiles.map(([href, label, n, hint]) => (
          <Link key={href} href={href} className="panel" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, textDecoration: 'none', alignItems: 'center' }}>
            <span><strong>{label}</strong><span className="muted small" style={{ display: 'block' }}>{hint}</span></span>
            <span className={n ? 'pill pill--pending' : 'pill'} style={{ fontSize: '1.1rem' }}>{n ?? 0}</span>
          </Link>
        ))}
      </div>
      <h2 className="section">More</h2>
      <ul className="chips">
        {[['/admin/finance', 'Money overview and exports'], ['/admin/health', 'Site health'], ['/admin/destinations', 'Destinations']].map(([h, l]) => <li key={h}><Link className="chip" href={h}>{l}</Link></li>)}
      </ul>
    </div>
  )
}
