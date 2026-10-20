import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processPendingRefunds } from '@/lib/refunds'
import { drainOutbox } from '@/lib/email/drain'

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
  const jobs = params.job === 'all' ? ['expire', 'complete', 'refunds', 'payouts', 'emails'] : [params.job]
  if (jobs.some((j) => !['expire', 'complete', 'payouts', 'refunds', 'emails'].includes(j))) return NextResponse.json({ error: 'Unknown job' }, { status: 404 })
  for (const j of jobs) await run(j)
  return NextResponse.json({ ok: true, ...out })
}
