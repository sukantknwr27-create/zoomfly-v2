import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { PaymentError, capturePayment, fetchOrder, fetchPayment } from '@/lib/razorpay'

export type BookingRow = {
  id: string
  booking_ref: string
  customer_id: string
  seller_id: string
  package_id: string
  departure_id: string
  package_title: string
  departure_date: string
  trip_end_date: string
  adults: number
  children: number
  infants: number
  seats: number
  traveller_details: { name?: string; age?: number | null }[]
  contact_name: string
  contact_phone: string
  contact_email: string | null
  unit_price_paise: number
  total_paise: number
  commission_paise: number
  advance_paise: number
  balance_due_on: string | null
  paid_paise: number
  cancellation_policy: string
  cancellation_tiers: { min_days_before: number; refund_pct: number }[]
  status: 'pending_payment' | 'confirmed' | 'fully_paid' | 'completed' | 'cancelled_by_customer' | 'cancelled_by_seller' | 'cancelled_by_admin' | 'expired'
  hold_expires_at: string | null
  created_at: string
}

// The ONE place a Razorpay payment turns into money in our books. Called by the browser's "payment done" call
// AND by the webhook; record_payment is idempotent on the payment id, so whichever arrives first wins and the
// other is a harmless repeat. We never trust amounts from the browser: order and payment are re-read from Razorpay.
export async function settlePayment(orderId: string, paymentId: string, expectedBookingId?: string): Promise<BookingRow> {
  const [order, payment] = await Promise.all([fetchOrder(orderId), fetchPayment(paymentId)])
  if (payment.order_id !== orderId) throw new PaymentError('That payment does not belong to this order.', 400)
  const bookingId = order.notes?.booking_id
  const kind = order.notes?.kind
  if (!bookingId || (kind !== 'advance' && kind !== 'balance')) throw new PaymentError('This order was not created for a ZoomFly booking.', 400)
  if (expectedBookingId && expectedBookingId !== bookingId) throw new PaymentError('That payment is for a different booking.', 400)
  if (payment.amount !== order.amount) throw new PaymentError('Payment amount does not match the order.', 400)

  let status = payment.status
  if (status === 'authorized') {
    await capturePayment(paymentId, payment.amount, payment.currency)
    status = 'captured'
  }
  if (status !== 'captured') throw new PaymentError(`Payment is ${status}, not captured.`, 402)

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('record_payment', { p_booking: bookingId, p_kind: kind, p_amount: payment.amount, p_order: orderId, p_payment: paymentId })
  if (error) throw new PaymentError(error.message, 409)
  return data as BookingRow
}
