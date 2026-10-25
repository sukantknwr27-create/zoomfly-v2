import { NextResponse, type NextRequest } from 'next/server'
import { apiUser, fail } from '@/lib/api'
import { rupees, toCsv } from '@/lib/csv'

const LIMIT = 20000
const day = /^\d{4}-\d{2}-\d{2}$/

// Admin-only CSV for the accountant. The date range filters on when each record was created (paid_at for payouts).
export async function GET(request: NextRequest, { params }: { params: { kind: string } }) {
  const { supabase, user } = await apiUser()
  if (!user) return fail('Sign in first.', 401)
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return fail('Not found.', 404)
  const sp = new URL(request.url).searchParams
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const from = day.test(sp.get('from') ?? '') ? sp.get('from')! : new Date(Date.now() - 30 * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const to = day.test(sp.get('to') ?? '') ? sp.get('to')! : today
  const lo = `${from}T00:00:00+05:30`, hi = `${to}T23:59:59.999+05:30`
  const send = (name: string, headers: string[], rows: unknown[][]) =>
    new NextResponse(toCsv(headers, rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="zoomfly-${name}-${from}-to-${to}.csv"` } })

  if (params.kind === 'bookings') {
    const { data } = await supabase.from('bookings').select('booking_ref, created_at, status, package_title, departure_date, seats, total_paise, paid_paise, commission_pct, commission_paise, contact_name, contact_phone, sellers(business_name, gstin)').gte('created_at', lo).lte('created_at', hi).order('created_at').limit(LIMIT)
    type R = { booking_ref: string; created_at: string; status: string; package_title: string; departure_date: string; seats: number; total_paise: number; paid_paise: number; commission_pct: number; commission_paise: number; contact_name: string; contact_phone: string; sellers: { business_name: string; gstin: string | null } | { business_name: string; gstin: string | null }[] | null }
    return send('bookings', ['Booking', 'Created', 'Status', 'Trip', 'Departure', 'Seats', 'Total (INR)', 'Paid (INR)', 'Commission %', 'Commission (INR)', 'Seller', 'Seller GSTIN', 'Customer', 'Customer phone'],
      ((data ?? []) as unknown as R[]).map((b) => { const s = Array.isArray(b.sellers) ? b.sellers[0] : b.sellers; return [b.booking_ref, b.created_at.slice(0, 10), b.status, b.package_title, b.departure_date, b.seats, rupees(b.total_paise), rupees(b.paid_paise), b.commission_pct, rupees(b.commission_paise), s?.business_name, s?.gstin, b.contact_name, b.contact_phone] }))
  }
  if (params.kind === 'payments') {
    const { data } = await supabase.from('payments').select('created_at, kind, amount_paise, status, razorpay_order_id, razorpay_payment_id, needs_review, bookings(booking_ref)').gte('created_at', lo).lte('created_at', hi).order('created_at').limit(LIMIT)
    type R = { created_at: string; kind: string; amount_paise: number; status: string; razorpay_order_id: string | null; razorpay_payment_id: string | null; needs_review: boolean; bookings: { booking_ref: string } | { booking_ref: string }[] | null }
    return send('payments', ['Date', 'Booking', 'Type', 'Amount (INR)', 'Status', 'Razorpay order', 'Razorpay payment', 'Needs review'],
      ((data ?? []) as unknown as R[]).map((p) => [p.created_at.slice(0, 10), (Array.isArray(p.bookings) ? p.bookings[0] : p.bookings)?.booking_ref, p.kind, rupees(p.amount_paise), p.status, p.razorpay_order_id, p.razorpay_payment_id, p.needs_review ? 'yes' : '']))
  }
  if (params.kind === 'refunds') {
    const { data } = await supabase.from('refunds').select('created_at, amount_paise, status, reason, razorpay_refund_id, processed_at, bookings(booking_ref)').gte('created_at', lo).lte('created_at', hi).order('created_at').limit(LIMIT)
    type R = { created_at: string; amount_paise: number; status: string; reason: string | null; razorpay_refund_id: string | null; processed_at: string | null; bookings: { booking_ref: string } | { booking_ref: string }[] | null }
    return send('refunds', ['Date', 'Booking', 'Amount (INR)', 'Status', 'Reason', 'Razorpay refund', 'Processed on'],
      ((data ?? []) as unknown as R[]).map((r) => [r.created_at.slice(0, 10), (Array.isArray(r.bookings) ? r.bookings[0] : r.bookings)?.booking_ref, rupees(r.amount_paise), r.status, r.reason, r.razorpay_refund_id, r.processed_at?.slice(0, 10) ?? '']))
  }
  if (params.kind === 'payouts') {
    const { data } = await supabase.from('seller_payouts').select('milestone, amount_paise, due_on, status, paid_at, utr, bookings(booking_ref), sellers(business_name, gstin, bank_account_number, bank_ifsc)').gte('due_on', from).lte('due_on', to).order('due_on').limit(LIMIT)
    type S = { business_name: string; gstin: string | null; bank_account_number: string | null; bank_ifsc: string | null }
    type R = { milestone: string; amount_paise: number; due_on: string; status: string; paid_at: string | null; utr: string | null; bookings: { booking_ref: string } | { booking_ref: string }[] | null; sellers: S | S[] | null }
    return send('payouts', ['Booking', 'Seller', 'Seller GSTIN', 'Account', 'IFSC', 'Payout', 'Amount (INR)', 'Due', 'Status', 'Paid on', 'UTR'],
      ((data ?? []) as unknown as R[]).map((p) => { const s = Array.isArray(p.sellers) ? p.sellers[0] : p.sellers; return [(Array.isArray(p.bookings) ? p.bookings[0] : p.bookings)?.booking_ref, s?.business_name, s?.gstin, s?.bank_account_number, s?.bank_ifsc, p.milestone, rupees(p.amount_paise), p.due_on, p.status, p.paid_at?.slice(0, 10) ?? '', p.utr ?? ''] }))
  }
  return fail('Unknown export.', 404)
}
