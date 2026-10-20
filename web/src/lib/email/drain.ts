import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderEmail } from './templates'
import { EmailError, emailConfigured, sendEmail } from './send'

type Row = { id: string; template: string; to_email: string; payload: Record<string, unknown>; attempts: number }

const MAX_ATTEMPTS = 5

// Sends what is waiting in email_outbox. Safe to call from anywhere, any number of times at once:
// each row is claimed (pending -> sending) by a single UPDATE, so two callers never send the same email.
export async function drainOutbox(limit = 20): Promise<{ sent: number; failed: number; retrying: number; configured: boolean }> {
  const out = { sent: 0, failed: 0, retrying: 0, configured: emailConfigured() }
  if (!out.configured) return out // leave everything queued; it sends once email is configured
  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://zoomfly.in'

  // a crashed run can leave rows stuck in 'sending'; put them back after 10 minutes
  await admin.from('email_outbox').update({ status: 'pending' }).eq('status', 'sending').lt('claimed_at', new Date(Date.now() - 10 * 60_000).toISOString())

  const { data: due } = await admin.from('email_outbox').select('id').eq('status', 'pending').lte('send_after', new Date().toISOString()).order('created_at').limit(limit)
  for (const d of due ?? []) {
    const { data: claimed } = await admin
      .from('email_outbox')
      .update({ status: 'sending', claimed_at: new Date().toISOString() })
      .eq('id', d.id)
      .eq('status', 'pending')
      .select('id, template, to_email, payload, attempts')
    const row = (claimed?.[0] as Row | undefined) ?? undefined
    if (!row) continue
    const attempts = row.attempts + 1
    try {
      const mail = renderEmail(row.template, row.payload ?? {}, siteUrl)
      if (!mail) throw new EmailError(`Unknown email template: ${row.template}`, false)
      const to = row.to_email === '__admin__' ? (process.env.ADMIN_NOTIFY_EMAIL ?? '').split(',').map((x) => x.trim()).filter(Boolean) : [row.to_email]
      if (to.length === 0) throw new EmailError('ADMIN_NOTIFY_EMAIL is not set.', false)
      await sendEmail({ id: row.id, to, subject: mail.subject, html: mail.html, text: mail.text })
      await admin.from('email_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), attempts, last_error: null }).eq('id', row.id)
      out.sent++
    } catch (e) {
      const err = e instanceof EmailError ? e : new EmailError(e instanceof Error ? e.message : 'Unknown error', true)
      const giveUp = !err.retryable || attempts >= MAX_ATTEMPTS
      await admin
        .from('email_outbox')
        .update({ status: giveUp ? 'failed' : 'pending', attempts, last_error: err.message.slice(0, 300), send_after: new Date(Date.now() + 2 ** attempts * 60_000).toISOString() })
        .eq('id', row.id)
      if (giveUp) out.failed++
      else out.retrying++
    }
  }
  return out
}

// Called right after something that queues an email, so it goes out in seconds. Never lets an email problem break the
// request that triggered it, and never waits more than ~3 seconds. The daily job and the retry button are the safety net.
export async function kickEmails(): Promise<void> {
  try {
    await Promise.race([drainOutbox(10), new Promise((resolve) => setTimeout(resolve, 3000))])
  } catch (e) {
    console.error('kickEmails failed', e)
  }
}
