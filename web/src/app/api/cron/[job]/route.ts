import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processPendingRefunds } from '@/lib/refunds'
import { drainOutbox } from '@/lib/email/drain'
import { reportError } from '@/lib/monitor'

// Scheduled jobs (see vercel.json). Vercel Cron sends "Authorization: Bearer $CRON_SECRET" automatically.
export async function GET(request: NextRequest, { params }: { params: { job: string } }) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const out: Record<string, unknown> = {}
  const run = async (name: string) => {
    if (name === 'expire') out.expired_holds = (await admin.rpc('expire_unpaid_bookings')).data
    if (name === 'complete') out.completed_bookings = (await admin.rpc('complete_due_bookings')).data
    if (name === 'payouts') out.payouts_released = ((await admin.rpc('release_due_payouts')).data ?? []).length
    if (name === 'refunds') out.refunds = await processPendingRefunds()
    if (name === 'purge') out.rate_limits_purged = (await admin.rpc('purge_rate_limits')).data
    if (name === 'emails') {
      out.reminders_queued = (await admin.rpc('enqueue_due_reminders')).data
      let totals = { sent: 0, failed: 0, retrying: 0, configured: true }
      for (let i = 0; i < 10; i++) {
        const r = await drainOutbox(20)
        totals = { sent: totals.sent + r.sent, failed: totals.failed + r.failed, retrying: totals.retrying + r.retrying, configured: r.configured }
        if (!r.configured || r.sent + r.failed + r.retrying < 20) break
      }
      out.emails = totals
    }
  }
  const jobs = params.job === 'all' ? ['expire', 'complete', 'refunds', 'payouts', 'purge', 'emails'] : [params.job]
  if (jobs.some((j) => !['expire', 'complete', 'payouts', 'refunds', 'emails', 'purge'].includes(j))) return NextResponse.json({ error: 'Unknown job' }, { status: 404 })
  // One failing job must not stop the others. Each failure is recorded and emailed to the admin, and every run leaves a heartbeat
  // that the health page checks, so a daily job that silently stopped running is noticed.
  let allOk = true
  for (const j of jobs) {
    try {
      await run(j)
    } catch (e) {
      allOk = false
      out[`${j}_error`] = e instanceof Error ? e.message : String(e)
      await reportError(`cron.${j}`, e)
    }
  }
  try { await admin.from('cron_runs').insert({ job: params.job, ok: allOk, summary: out }) } catch (e) { console.error('cron heartbeat failed', e) }
  return NextResponse.json({ ok: allOk, ...out }, { status: allOk ? 200 : 500 })
}
