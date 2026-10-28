import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
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
    </div>
  )
}
