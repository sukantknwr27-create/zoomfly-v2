import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processPendingRefunds } from '@/lib/refunds'

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
  }
  const jobs = params.job === 'all' ? ['expire', 'complete', 'refunds', 'payouts'] : [params.job]
  if (jobs.some((j) => !['expire', 'complete', 'payouts', 'refunds'].includes(j))) return NextResponse.json({ error: 'Unknown job' }, { status: 404 })
  for (const j of jobs) await run(j)
  return NextResponse.json({ ok: true, ...out })
}
