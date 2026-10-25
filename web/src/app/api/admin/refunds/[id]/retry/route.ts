import { NextResponse, type NextRequest } from 'next/server'
import { apiUser, fail } from '@/lib/api'
import { processPendingRefunds } from '@/lib/refunds'
import { kickEmails } from '@/lib/email/drain'
import { reportError } from '@/lib/monitor'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user } = await apiUser()
  if (!user) return fail('Sign in first.', 401)
  const { error } = await supabase.rpc('retry_failed_refund', { p_refund: params.id })
  if (error) return fail(/Not allowed/i.test(error.message) ? 'Only admins can do this.' : 'That refund is not in a failed state.', /Not allowed/i.test(error.message) ? 403 : 409)
  let result = { done: 0, failed: 0 }
  try { result = await processPendingRefunds() } catch (e) { await reportError('admin.refund.retry', e) }
  await kickEmails()
  return NextResponse.json({ ok: true, ...result })
}
