import { NextResponse } from 'next/server'
import { apiUser, fail } from '@/lib/api'
import { rupees, toCsv } from '@/lib/csv'

export async function GET() {
  const { supabase, user } = await apiUser()
  if (!user) return fail('Sign in first.', 401)
  // row-level security: a seller can only ever read their own payouts and bookings
  const [{ data: po }, { data: bk }] = await Promise.all([
    supabase.from('seller_payouts').select('booking_id, milestone, amount_paise, due_on, status, paid_at, utr').order('due_on'),
    supabase.from('seller_bookings').select('id, booking_ref, package_title'),
  ])
  const ref = new Map((bk ?? []).map((b: { id: string; booking_ref: string; package_title: string }) => [b.id, b]))
  const rows = (po ?? []).map((p: { booking_id: string; milestone: string; amount_paise: number; due_on: string; status: string; paid_at: string | null; utr: string | null }) => [
    ref.get(p.booking_id)?.booking_ref, ref.get(p.booking_id)?.package_title, p.milestone, rupees(p.amount_paise), p.due_on, p.status, p.paid_at?.slice(0, 10) ?? '', p.utr ?? '',
  ])
  return new NextResponse(toCsv(['Booking', 'Trip', 'Payout', 'Amount (INR)', 'Due', 'Status', 'Paid on', 'Bank reference (UTR)'], rows), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="zoomfly-payouts.csv"' },
  })
}
