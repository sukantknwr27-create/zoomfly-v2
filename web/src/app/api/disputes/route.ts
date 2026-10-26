import { NextResponse, type NextRequest } from 'next/server'
import { apiUser, fail } from '@/lib/api'
import { kickEmails } from '@/lib/email/drain'
import { allow } from '@/lib/ratelimit'

export async function POST(request: NextRequest) {
  const { supabase, user } = await apiUser()
  if (!user) return fail('Sign in first.', 401)
  if (!(await allow(`dispute:${user.id}`, 5, 86400))) return fail('You have sent several reports today. We will reply to them soon.', 429)
  const b = await request.json().catch(() => ({}))
  const reason = String(b?.reason ?? '').trim()
  if (reason.length < 10 || reason.length > 4000) return fail('Describe the problem in at least a sentence (up to 4000 characters).', 400)
  const { error } = await supabase.from('disputes').insert({ booking_id: String(b?.bookingId ?? ''), reason })
  if (error) {
    if (/confirmed booking/i.test(error.message)) return fail('You can report a problem once a booking is confirmed.', 409)
    return fail('You cannot report a problem on that booking.', 403)
  }
  await kickEmails()
  return NextResponse.json({ ok: true })
}
