import { NextResponse, type NextRequest } from 'next/server'
import { apiUser, fail } from '@/lib/api'

const REASONS = ['fake_package', 'fake_reviews', 'repeated_cancellation', 'non_delivery', 'off_platform', 'fraud', 'other']

export async function POST(request: NextRequest) {
  const { supabase, user } = await apiUser()
  if (!user) return fail('Sign in first.', 401)
  const b = await request.json().catch(() => ({}))
  if (!REASONS.includes(String(b?.reason))) return fail('Choose a reason.', 400)
  const { error } = await supabase.rpc('issue_strike', { p_seller: String(b?.sellerId ?? ''), p_reason: String(b.reason), p_note: String(b?.note ?? '').slice(0, 500) || null, p_booking: b?.bookingId || null })
  if (error) return fail(/Not allowed/i.test(error.message) ? 'Only admins can issue strikes.' : 'Could not issue the strike.', /Not allowed/i.test(error.message) ? 403 : 400)
  return NextResponse.json({ ok: true })
}
