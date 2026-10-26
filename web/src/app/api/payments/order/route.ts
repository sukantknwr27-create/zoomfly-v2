import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PaymentError, createOrder, razorpayKeyId } from '@/lib/razorpay'
import { allow } from '@/lib/ratelimit'
import { reportError } from '@/lib/monitor'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
    if (!(await allow(`order:${user.id}`, 30, 3600))) return NextResponse.json({ error: 'Too many payment attempts. Please wait a little.' }, { status: 429 })
    const body = await request.json().catch(() => ({}))
    const kind = body?.kind === 'balance' ? 'balance' : 'advance'

    const { data: b } = await supabase
      .from('bookings')
      .select('id, booking_ref, status, total_paise, advance_paise, paid_paise, hold_expires_at, package_title, contact_name, contact_phone, contact_email')
      .eq('id', String(body?.bookingId ?? ''))
      .maybeSingle() // RLS: only the customer's own bookings are visible
    if (!b) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })

    // The amount is decided here from our own records, never from the browser.
    let amount: number
    if (kind === 'advance') {
      if (b.status !== 'pending_payment') return NextResponse.json({ error: 'This booking is not waiting for its first payment.' }, { status: 409 })
      if (b.hold_expires_at && new Date(b.hold_expires_at) < new Date()) return NextResponse.json({ error: 'Your seat hold has expired. Please book again.' }, { status: 409 })
      amount = Number(b.advance_paise) - Number(b.paid_paise)
    } else {
      if (b.status !== 'confirmed') return NextResponse.json({ error: 'There is no balance due on this booking.' }, { status: 409 })
      amount = Number(b.total_paise) - Number(b.paid_paise)
    }
    if (amount <= 0) return NextResponse.json({ error: 'Nothing is due.' }, { status: 409 })

    const order = await createOrder(amount, b.booking_ref, { booking_id: b.id, kind, booking_ref: b.booking_ref })
    return NextResponse.json({
      keyId: razorpayKeyId(), orderId: order.id, amount: order.amount, bookingRef: b.booking_ref, description: `${b.package_title} (${kind === 'advance' ? 'advance' : 'balance'})`,
      prefill: { name: b.contact_name, email: b.contact_email ?? user.email ?? '', contact: b.contact_phone },
    })
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: e.status })
    await reportError('payments.order', e)
    return NextResponse.json({ error: 'Could not start the payment. Try again.' }, { status: 500 })
  }
}
