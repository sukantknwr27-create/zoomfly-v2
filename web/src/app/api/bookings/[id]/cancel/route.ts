import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  // Row-level security only lets customers see their own bookings, so this doubles as the ownership check.
  const { data: own } = await supabase.from('bookings').select('id, status').eq('id', params.id).maybeSingle()
  if (!own) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
  const body = await request.json().catch(() => ({}))
  const reason = String(body?.reason ?? '').trim().slice(0, 300) || null

  const admin = createAdminClient()
  const { error } = await admin.rpc('cancel_booking', { p_booking: params.id, p_by: 'customer', p_reason: reason })
  if (error) return NextResponse.json({ error: /cannot be cancelled/i.test(error.message) ? 'This booking can no longer be cancelled.' : 'We could not cancel the booking. Try again.' }, { status: 409 })
  const { data: refund } = await admin.from('refunds').select('amount_paise').eq('booking_id', params.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return NextResponse.json({ ok: true, refund_paise: refund ? Number(refund.amount_paise) : 0 })
}
