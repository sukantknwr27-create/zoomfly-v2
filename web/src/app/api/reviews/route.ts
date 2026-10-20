import { NextResponse, type NextRequest } from 'next/server'
import { apiUser, fail } from '@/lib/api'

const rating = (v: unknown, required: boolean): number | null | 'bad' => {
  if (v === undefined || v === null || v === '') return required ? 'bad' : null
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 'bad'
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await apiUser()
  if (!user) return fail('Sign in first.', 401)
  const b = await request.json().catch(() => ({}))
  const value_for_money = rating(b?.value_for_money, true), matched_listing = rating(b?.matched_listing, true), overall = rating(b?.overall, true)
  const hotel_quality = rating(b?.hotel_quality, false), transport = rating(b?.transport, false), guide_support = rating(b?.guide_support, false)
  if ([value_for_money, matched_listing, overall, hotel_quality, transport, guide_support].includes('bad')) return fail('Give each rating from 1 to 5.', 400)
  const comment = String(b?.comment ?? '').trim().slice(0, 2000) || null
  const { error } = await supabase.from('reviews').insert({ booking_id: String(b?.bookingId ?? ''), value_for_money, hotel_quality, transport, guide_support, matched_listing, overall, comment })
  if (error) {
    if (error.code === '23505') return fail('You have already reviewed this trip.', 409)
    if (/completed/i.test(error.message)) return fail('You can review a trip after it is completed.', 409)
    if (/own trip/i.test(error.message)) return fail('You can only review your own trip.', 403)
    return fail('Could not save your review.', 400)
  }
  return NextResponse.json({ ok: true })
}
