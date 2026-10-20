import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PaymentError, verifyCheckoutSignature } from '@/lib/razorpay'
import { settlePayment } from '@/lib/payments'
import { kickEmails } from '@/lib/email/drain'

// The browser calls this the moment Razorpay Checkout reports success, so the customer sees "Booked" immediately.
// The webhook does the same job independently, in case the customer closes the tab.
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
    const b = await request.json().catch(() => ({}))
    const { bookingId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = b ?? {}
    if (!bookingId || !orderId || !paymentId || !signature) return NextResponse.json({ error: 'Missing payment details.' }, { status: 400 })
    const { data: own } = await supabase.from('bookings').select('id').eq('id', String(bookingId)).maybeSingle()
    if (!own) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    if (!verifyCheckoutSignature(String(orderId), String(paymentId), String(signature))) return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 400 })

    const booking = await settlePayment(String(orderId), String(paymentId), String(bookingId))
    await kickEmails()
    return NextResponse.json({ ok: true, status: booking.status })
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('verify failed', e)
    return NextResponse.json({ error: 'We could not confirm the payment yet. If money was deducted, it will show on your booking shortly.' }, { status: 500 })
  }
}
