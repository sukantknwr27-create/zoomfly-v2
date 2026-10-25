import { NextResponse, type NextRequest } from 'next/server'
import { apiUser, fail } from '@/lib/api'
import { kickEmails } from '@/lib/email/drain'
import { processPendingRefunds } from '@/lib/refunds'
import { reportError } from '@/lib/monitor'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user } = await apiUser()
  if (!user) return fail('Sign in first.', 401)
  const b = await request.json().catch(() => ({}))
  const pct = Number(b?.refundPct)
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) return fail('Refund must be a whole number from 0 to 100.', 400)
  // cancel_booking refuses anyone who is not an admin, so this needs no extra check here
  const { error } = await supabase.rpc('cancel_booking', { p_booking: params.id, p_by: 'admin', p_reason: String(b?.reason ?? '').slice(0, 300) || 'Cancelled by ZoomFly', p_refund_pct: pct })
  if (error) return fail(/Not allowed/i.test(error.message) ? 'Only admins can do this.' : /cannot be cancelled/i.test(error.message) ? 'This booking can no longer be cancelled.' : 'Could not cancel the booking.', /Not allowed/i.test(error.message) ? 403 : 409)
  try { await processPendingRefunds() } catch (e) { await reportError('admin.cancel.refund', e) }
  await kickEmails()
  return NextResponse.json({ ok: true })
}
