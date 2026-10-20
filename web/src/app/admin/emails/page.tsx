import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { RetryEmails } from '@/components/RetryEmails'

export const metadata: Metadata = { title: 'Emails' }
export const dynamic = 'force-dynamic'

type R = { id: string; template: string; to_email: string; status: string; attempts: number; last_error: string | null; created_at: string; sent_at: string | null }

export default async function AdminEmails() {
  await requireAdmin('/admin/emails')
  const supabase = createClient()
  const configured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
  const adminAddress = Boolean(process.env.ADMIN_NOTIFY_EMAIL)
  const { data } = await supabase.from('email_outbox').select('id, template, to_email, status, attempts, last_error, created_at, sent_at').order('created_at', { ascending: false }).limit(80)
  const rows = (data ?? []) as R[]
  const count = (s: string) => rows.filter((r) => r.status === s).length

  return (
    <div className="wrap page">
      <div className="page__head"><h1>Emails</h1><p className="muted">Every email the site needs to send is queued here first. Failed ones are retried automatically.</p></div>
      {!configured && <p className="notice notice--error" role="alert"><strong>Email is not configured.</strong> Nothing is being sent. Messages wait in the queue and go out as soon as you add RESEND_API_KEY and EMAIL_FROM.</p>}
      {configured && !adminAddress && <p className="notice notice--wait">ADMIN_NOTIFY_EMAIL is not set, so alerts to you (new sellers, trips, disputes) cannot be sent.</p>}
      <div className="status-line">
        <span className="pill pill--approved">{count('sent')} sent</span>
        <span className="pill pill--pending">{count('pending') + count('sending')} waiting</span>
        <span className={count('failed') ? 'pill pill--bad' : 'pill'}>{count('failed')} failed</span>
        <RetryEmails failed={count('failed')} />
      </div>
      {rows.length === 0 ? <p className="panel">Nothing yet.</p> : (
        <table className="table">
          <thead><tr><th>When</th><th>Email</th><th>To</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</td>
                <td>{r.template}</td>
                <td>{r.to_email === '__admin__' ? 'You (admin)' : r.to_email}</td>
                <td>{r.status}{r.attempts > 0 && r.status !== 'sent' ? `, ${r.attempts} tries` : ''}{r.last_error ? <div className="small muted">{r.last_error}</div> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
