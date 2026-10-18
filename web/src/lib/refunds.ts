import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchPayment, refundPayment } from '@/lib/razorpay'

// Sends every pending refund to Razorpay. A refund can span several payments (advance + balance), so we walk the
// booking's captured payments and refund what each can still give back. A refund row is claimed first
// (pending -> processing) so two overlapping runs can never refund the same money twice.
export async function processPendingRefunds(): Promise<{ done: number; failed: number }> {
  const admin = createAdminClient()
  const { data: pending } = await admin.from('refunds').select('id, booking_id, amount_paise, reason').eq('status', 'pending').order('created_at').limit(50)
  let done = 0, failed = 0
  for (const r of pending ?? []) {
    const { data: claimed } = await admin.from('refunds').update({ status: 'processing' }).eq('id', r.id).eq('status', 'pending').select('id')
    if (!claimed || claimed.length === 0) continue
    try {
      const { data: pays } = await admin.from('payments').select('razorpay_payment_id, amount_paise').eq('booking_id', r.booking_id).eq('status', 'captured').order('created_at', { ascending: false })
      let remaining = Number(r.amount_paise)
      const ids: string[] = []
      for (const p of pays ?? []) {
        if (remaining <= 0 || !p.razorpay_payment_id) continue
        const live = await fetchPayment(p.razorpay_payment_id)
        const refundable = live.amount - (live.amount_refunded ?? 0)
        const take = Math.min(remaining, refundable)
        if (take <= 0) continue
        const rf = await refundPayment(p.razorpay_payment_id, take, { refund_row: r.id, booking_id: r.booking_id })
        ids.push(rf.id)
        remaining -= take
      }
      if (remaining > 0) throw new Error(`Could not refund ${remaining} paise: not enough refundable payments`)
      await admin.from('refunds').update({ status: 'done', razorpay_refund_id: ids.join(','), processed_at: new Date().toISOString() }).eq('id', r.id)
      done++
    } catch (e) {
      console.error('refund failed', r.id, e)
      await admin.from('refunds').update({ status: 'failed' }).eq('id', r.id)
      failed++
    }
  }
  return { done, failed }
}
