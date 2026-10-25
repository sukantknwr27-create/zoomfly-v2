import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BookingRow } from '@/lib/payments'
import { allow } from '@/lib/ratelimit'
import { TERMS_VERSION } from '@/lib/site'

type Body = {
  departureId?: string
  adults?: number
  children?: number
  infants?: number
  travellers?: { name?: string; age?: number | string | null }[]
  contact?: { name?: string; phone?: string; email?: string }
  acceptTerms?: boolean
}

const err = (message: string, status: number) => NextResponse.json({ error: message }, { status })

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return err('Sign in to book.', 401)
  if (!(await allow(`book:${user.id}`, 15, 3600))) return err('You are booking too fast. Please wait a little and try again.', 429)

  let b: Body
  try {
    b = await request.json()
  } catch {
    return err('Invalid request.', 400)
  }
  if (b.acceptTerms !== true) return err('Please accept the Terms of Use and the cancellation policy to book.', 400)
  const adults = Number(b.adults), children = Number(b.children ?? 0), infants = Number(b.infants ?? 0)
  if (!b.departureId || !Number.isInteger(adults) || adults < 1 || adults > 20) return err('Choose a departure and at least one adult.', 400)
  if (!Number.isInteger(children) || children < 0 || children > 20 || !Number.isInteger(infants) || infants < 0 || infants > 10) return err('Check the number of children and infants.', 400)

  const name = String(b.contact?.name ?? '').trim()
  const phone = String(b.contact?.phone ?? '').replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '')
  const email = String(b.contact?.email ?? user.email ?? '').trim()
  if (name.length < 2) return err('Enter the lead traveller’s name.', 400)
  if (!/^[6-9]\d{9}$/.test(phone)) return err('Enter a 10-digit Indian mobile number.', 400)
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return err('Enter a valid email address.', 400)

  const travellers = (b.travellers ?? []).slice(0, adults + children + infants).map((t) => ({
    name: String(t?.name ?? '').trim().slice(0, 80),
    age: t?.age === '' || t?.age == null ? null : Math.max(0, Math.min(120, Number(t.age) || 0)),
  }))
  if (travellers.slice(0, adults + children).some((t) => t.name.length < 2)) return err('Enter the name of every traveller who needs a seat.', 400)

  // The price is computed inside the database from the seller's own data; the browser never sends an amount.
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('create_booking', {
    p_customer: user.id, p_departure: b.departureId, p_adults: adults, p_children: children, p_infants: infants,
    p_travellers: travellers, p_contact_name: name, p_contact_phone: phone, p_contact_email: email || null,
  })
  if (error) {
    const m = error.message
    if (/Seats not available/i.test(m)) return err('Sorry, there are not enough seats left on that date.', 409)
    if (/closed for booking|not available|not found/i.test(m)) return err('That departure is no longer open for booking.', 409)
    return err('We could not reserve your seats. Please try again.', 400)
  }
  const bk = data as BookingRow
  await admin.from('bookings').update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }).eq('id', bk.id)
  return NextResponse.json({ id: bk.id, ref: bk.booking_ref, status: bk.status, total_paise: bk.total_paise, advance_paise: bk.advance_paise, hold_expires_at: bk.hold_expires_at })
}
