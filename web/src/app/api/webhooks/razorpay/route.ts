import { NextResponse, type NextRequest } from 'next/server'
import { PaymentError, verifyWebhookSignature } from '@/lib/razorpay'
import { settlePayment } from '@/lib/payments'
import { kickEmails } from '@/lib/email/drain'

// Razorpay -> Dashboard -> Webhooks: URL https://YOUR-SITE/api/webhooks/razorpay, events payment.captured and order.paid,
// secret = RAZORPAY_WEBHOOK_SECRET. A non-2xx answer makes Razorpay retry, so only genuine temporary failures return 5xx.
export async function POST(request: NextRequest) {
  const raw = await request.text()
  if (!verifyWebhookSignature(raw, request.headers.get('x-razorpay-signature'))) return NextResponse.json({ error: 'Bad signature' }, { status: 400 })
  let event: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } }
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 })
  }
  if (event.event !== 'payment.captured' && event.event !== 'order.paid') return NextResponse.json({ ok: true, ignored: event.event })
  const p = event.payload?.payment?.entity
  if (!p?.id || !p.order_id) return NextResponse.json({ ok: true, ignored: 'no payment' })
  try {
    const booking = await settlePayment(p.order_id, p.id)
    await kickEmails()
    return NextResponse.json({ ok: true, status: booking.status })
  } catch (e) {
    if (e instanceof PaymentError && e.status < 500) {
      console.error('webhook: payment not applied', p.id, e.message) // permanent: acknowledge so Razorpay stops retrying
      return NextResponse.json({ ok: true, ignored: e.message })
    }
    console.error('webhook failed', e)
    return NextResponse.json({ error: 'Temporary failure' }, { status: 500 })
  }
}
