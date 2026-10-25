import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

export const metadata: Metadata = { title: 'Site health', robots: { index: false } }
export const dynamic = 'force-dynamic'

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`
}

export default async function Health() {
  await requireAdmin('/admin/health')
  const s = createClient()
  const head = (t: string) => s.from(t).select('*', { count: 'exact', head: true })
  const nowIso = new Date().toISOString()
  const [runs, errs, pendingMail, failedMail, pendingRefunds, failedRefunds, staleHolds, overdueDisputes, review] = await Promise.all([
    s.from('cron_runs').select('job, ok, ran_at, summary').order('ran_at', { ascending: false }).limit(40),
    s.from('app_errors').select('id, context, message, created_at').order('created_at', { ascending: false }).limit(15),
    head('email_outbox').eq('status', 'pending'),
    head('email_outbox').eq('status', 'failed'),
    head('refunds').eq('status', 'pending'),
    head('refunds').eq('status', 'failed'),
    head('bookings').eq('status', 'pending_payment').lt('hold_expires_at', nowIso),
    head('disputes').neq('status', 'resolved').lt('resolution_due', nowIso),
    head('payments').eq('needs_review', true),
  ])
  const latest = new Map<string, { ok: boolean; ran_at: string }>()
  for (const r of (runs.data ?? []) as { job: string; ok: boolean; ran_at: string }[]) if (!latest.has(r.job)) latest.set(r.job, r)
  const all = latest.get('all')
  const cronStale = !all || Date.now() - new Date(all.ran_at).getTime() > 36 * 3600_000
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
  const checks: [string, boolean, string][] = [
    ['Daily job', !cronStale && all?.ok !== false, all ? `Last ran ${ago(all.ran_at)}${all.ok ? '' : ', with errors'}` : 'It has never run. Check the cron settings and CRON_SECRET'],
    ['Email', emailConfigured && (failedMail.count ?? 0) === 0, !emailConfigured ? 'Not configured: nothing is being sent' : `${pendingMail.count ?? 0} waiting, ${failedMail.count ?? 0} failed`],
    ['Refunds', (failedRefunds.count ?? 0) === 0, `${pendingRefunds.count ?? 0} waiting to be sent, ${failedRefunds.count ?? 0} failed`],
    ['Seat holds', (staleHolds.count ?? 0) < 20, `${staleHolds.count ?? 0} lapsed holds not yet cleared (cleared by the daily job, and instantly when someone books)`],
    ['Disputes', (overdueDisputes.count ?? 0) === 0, `${overdueDisputes.count ?? 0} past their 7-day target`],
    ['Payments to review', (review.count ?? 0) === 0, `${review.count ?? 0} payments arrived for bookings that were no longer payable (refunds queued)`],
    ['Payments', Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_WEBHOOK_SECRET), process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_WEBHOOK_SECRET ? 'Keys and webhook secret are set' : 'Razorpay keys or webhook secret missing'],
  ]
  return (
    <div className="wrap page">
      <p className="small"><Link href="/admin">Admin</Link></p>
      <div className="page__head"><h1>Site health</h1></div>
      <table className="table">
        <tbody>{checks.map(([name, ok, text]) => <tr key={name}><td style={{ width: 90 }}><span className={ok ? 'pill pill--approved' : 'pill pill--bad'}>{ok ? 'OK' : 'Check'}</span></td><td><strong>{name}</strong><div className="muted small">{text}</div></td></tr>)}</tbody>
      </table>
      <h2 className="section">Scheduled jobs</h2>
      {latest.size === 0 ? <p className="panel">No job has run yet.</p> : (
        <table className="table"><thead><tr><th>Job</th><th>Last run</th><th>Result</th></tr></thead>
          <tbody>{[...latest.entries()].map(([job, r]) => <tr key={job}><td>{job}</td><td>{ago(r.ran_at)}</td><td>{r.ok ? 'OK' : 'Errors'}</td></tr>)}</tbody></table>
      )}
      <h2 className="section">Recent errors</h2>
      {(errs.data ?? []).length === 0 ? <p className="panel">None recorded.</p> : (
        <table className="table"><thead><tr><th>When</th><th>Where</th><th>What</th></tr></thead>
          <tbody>{(errs.data as { id: string; context: string; message: string; created_at: string }[]).map((e) => <tr key={e.id}><td>{ago(e.created_at)}</td><td>{e.context}</td><td>{e.message}</td></tr>)}</tbody></table>
      )}
      <p className="muted small" style={{ marginTop: 20 }}>Database backups are managed in Supabase (Project settings, Database, Backups). Check them there.</p>
    </div>
  )
}
