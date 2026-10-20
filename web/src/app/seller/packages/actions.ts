'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { lines, rupeesToPaise } from '@/lib/packages'
import { kickEmails } from '@/lib/email/drain'

type Kind = 'error' | 'ok'
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const intOrNull = (v: string) => (v === '' ? null : Number.isInteger(Number(v)) ? Number(v) : NaN)

async function session() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/seller/packages')
  return { supabase, user }
}
const back = (id: string, kind: Kind, msg: string, hash = ''): never => redirect(`/seller/packages/${id}?${kind}=${encodeURIComponent(msg)}${hash}`)

export async function createPackage(formData: FormData) {
  const { supabase } = await session()
  const title = str(formData, 'title')
  const destination_id = str(formData, 'destination_id') || null
  if (title.length < 5) redirect('/seller/packages/new?error=' + encodeURIComponent('Give the trip a title of at least 5 characters.'))
  const { data, error } = await supabase.from('packages').insert({ title, destination_id, slug: '' }).select('id').single()
  if (error || !data) redirect('/seller/packages/new?error=' + encodeURIComponent(error?.message?.includes('approved sellers') ? 'Only approved sellers can add trips.' : 'Could not create the trip. Try again.'))
  redirect(`/seller/packages/${data.id}?ok=${encodeURIComponent('Draft created. Fill in the details below.')}`)
}

export async function savePackage(formData: FormData) {
  const id = str(formData, 'id')
  const intent = str(formData, 'intent') // 'save' | 'submit'
  const { supabase } = await session()

  const { data: before } = await supabase.from('packages').select('listing_status').eq('id', id).maybeSingle()
  if (!before) redirect('/seller/packages')

  const title = str(formData, 'title')
  if (title.length < 5) back(id, 'error', 'Give the trip a title of at least 5 characters.')
  const duration_days = intOrNull(str(formData, 'duration_days'))
  const nights = intOrNull(str(formData, 'nights'))
  const min_group = intOrNull(str(formData, 'min_group'))
  const max_group = intOrNull(str(formData, 'max_group'))
  for (const [v, label] of [[duration_days, 'days'], [nights, 'nights'], [min_group, 'minimum group size'], [max_group, 'maximum group size']] as [number | null, string][])
    if (v !== null && (Number.isNaN(v) || v < 0)) back(id, 'error', `Enter a whole number for ${label}.`)
  if (duration_days !== null && (duration_days < 1 || duration_days > 60)) back(id, 'error', 'The trip length must be between 1 and 60 days.')
  if (min_group !== null && max_group !== null && max_group < min_group) back(id, 'error', 'The maximum group size cannot be smaller than the minimum.')
  const priceRaw = str(formData, 'price')
  const price_paise = priceRaw ? rupeesToPaise(priceRaw) : null
  if (priceRaw && price_paise === null) back(id, 'error', 'Enter the price as a number of rupees, for example 15000.')

  const dayCount = Math.min(Math.max(Number(str(formData, 'day_count')) || 0, 0), 60)
  const itinerary: { day: number; title: string; description: string }[] = []
  for (let i = 1; i <= dayCount; i++) {
    const t = str(formData, `day_title_${i}`)
    const d = str(formData, `day_desc_${i}`)
    if (t || d) itinerary.push({ day: itinerary.length + 1, title: t || `Day ${i}`, description: d })
  }
  const difficulty = str(formData, 'difficulty_level')
  const patch = {
    title,
    description: str(formData, 'description') || null,
    destination_id: str(formData, 'destination_id') || null,
    departure_city: str(formData, 'departure_city') || null,
    pickup_point: str(formData, 'pickup_point') || null,
    drop_point: str(formData, 'drop_point') || null,
    duration_days, nights, price_paise,
    occupancy_basis: str(formData, 'occupancy_basis') || null,
    price_includes_taxes: formData.get('price_includes_taxes') === 'on',
    inclusions: lines(formData.get('inclusions')),
    exclusions: lines(formData.get('exclusions')),
    itinerary: itinerary.length ? itinerary : null,
    hotel_details: str(formData, 'hotel_details') || null,
    meal_plan: str(formData, 'meal_plan') || null,
    vehicle_type: str(formData, 'vehicle_type') || null,
    min_group, max_group,
    child_policy: str(formData, 'child_policy') || null,
    difficulty_level: ['easy', 'moderate', 'hard'].includes(difficulty) ? difficulty : null,
    high_risk_activities: formData.get('high_risk_activities') === 'on',
    insurance_provided: formData.get('insurance_provided') === 'on',
    insurance_details: str(formData, 'insurance_details') || null,
    cancellation_policy: str(formData, 'cancellation_policy') || null,
  }
  const { error } = await supabase.from('packages').update(patch).eq('id', id)
  if (error) back(id, 'error', cleanDbMessage(error.message))

  if (intent === 'submit') {
    const { error: e2 } = await supabase.from('packages').update({ listing_status: 'submitted' }).eq('id', id)
    if (e2) back(id, 'error', cleanDbMessage(e2.message))
    await kickEmails()
    back(id, 'ok', 'Sent for review. We will email you when it is live or if we need changes.')
  }
  const { data: after } = await supabase.from('packages').select('listing_status').eq('id', id).maybeSingle()
  if (before.listing_status === 'published' && after?.listing_status === 'submitted') {
    await kickEmails()
    back(id, 'ok', 'Saved. You changed details travellers rely on, so the trip is back in review and hidden until we approve it.')
  }
  back(id, 'ok', 'Saved.')
}

// The database speaks plainly ("Package incomplete. Missing: ..."); strip only the technical wrapper.
function cleanDbMessage(m: string): string {
  if (/row-level security|violates/i.test(m)) return 'You cannot make that change. If the trip is not approved for editing, contact ZoomFly.'
  if (/duplicate key/i.test(m)) return 'Something with the same name already exists.'
  return m
}

export async function addPhotos(formData: FormData) {
  const id = str(formData, 'id')
  const { supabase, user } = await session()
  const paths = formData.getAll('photo_path').map(String).filter((p) => p.startsWith(`${user.id}/${id}/`) && !p.includes('..'))
  if (paths.length === 0) back(id, 'error', 'Choose at least one photo and wait for it to finish uploading.', '#photos')
  const { data: pkg } = await supabase.from('packages').select('photos').eq('id', id).maybeSingle()
  if (!pkg) redirect('/seller/packages')
  const urls = paths.map((p) => supabase.storage.from('package-photos').getPublicUrl(p).data.publicUrl)
  const next = [...(pkg.photos ?? []), ...urls].slice(0, 12)
  const { error } = await supabase.from('packages').update({ photos: next }).eq('id', id)
  if (error) back(id, 'error', cleanDbMessage(error.message), '#photos')
  back(id, 'ok', `${urls.length} ${urls.length === 1 ? 'photo' : 'photos'} added.`, '#photos')
}

export async function removePhoto(formData: FormData) {
  const id = str(formData, 'id')
  const url = str(formData, 'url')
  const { supabase, user } = await session()
  const { data: pkg } = await supabase.from('packages').select('photos').eq('id', id).maybeSingle()
  if (!pkg) redirect('/seller/packages')
  const next = (pkg.photos ?? []).filter((u: string) => u !== url)
  const { error } = await supabase.from('packages').update({ photos: next }).eq('id', id)
  if (error) back(id, 'error', cleanDbMessage(error.message), '#photos')
  const marker = '/package-photos/'
  const at = url.indexOf(marker)
  if (at >= 0) {
    const path = decodeURIComponent(url.slice(at + marker.length))
    if (path.startsWith(`${user.id}/`)) await supabase.storage.from('package-photos').remove([path])
  }
  back(id, 'ok', 'Photo removed.', '#photos')
}

export async function addDeparture(formData: FormData) {
  const id = str(formData, 'id')
  const { supabase } = await session()
  const departure_date = str(formData, 'departure_date')
  const return_date = str(formData, 'return_date') || null
  const total_seats = Number(str(formData, 'total_seats'))
  const cutoff = str(formData, 'booking_cutoff_days')
  const overrideRaw = str(formData, 'price_override')
  const price_override_paise = overrideRaw ? rupeesToPaise(overrideRaw) : null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(departure_date)) back(id, 'error', 'Choose the departure date.', '#departures')
  if (return_date && return_date < departure_date) back(id, 'error', 'The return date cannot be before the departure date.', '#departures')
  if (!Number.isInteger(total_seats) || total_seats < 1 || total_seats > 500) back(id, 'error', 'Enter how many seats you are selling (1 to 500).', '#departures')
  if (overrideRaw && price_override_paise === null) back(id, 'error', 'Enter the special price as a number of rupees, or leave it empty.', '#departures')
  const booking_cutoff_days = cutoff === '' ? 2 : Number(cutoff)
  if (!Number.isInteger(booking_cutoff_days) || booking_cutoff_days < 0 || booking_cutoff_days > 30) back(id, 'error', 'Booking closes 0 to 30 days before departure.', '#departures')
  const { error } = await supabase.from('package_departures').insert({ package_id: id, departure_date, return_date, total_seats, price_override_paise, booking_cutoff_days })
  if (error) back(id, 'error', error.code === '23505' ? 'You already have a departure on that date.' : error.message.includes('past') ? 'That date has already passed.' : cleanDbMessage(error.message), '#departures')
  back(id, 'ok', 'Departure added.', '#departures')
}

export async function removeDeparture(formData: FormData) {
  const id = str(formData, 'id')
  const { supabase } = await session()
  const { error } = await supabase.from('package_departures').delete().eq('id', str(formData, 'departure_id'))
  if (error) back(id, 'error', error.message.includes('bookings') ? 'This departure has bookings. Cancel it instead; travellers will be refunded in full.' : cleanDbMessage(error.message), '#departures')
  back(id, 'ok', 'Departure removed.', '#departures')
}

export async function cancelDeparture(formData: FormData) {
  const id = str(formData, 'id')
  const { supabase } = await session()
  const { data, error } = await supabase.rpc('cancel_departure_by_seller', { p_departure: str(formData, 'departure_id'), p_reason: str(formData, 'reason') || null })
  if (error) back(id, 'error', error.message.includes('Not your') ? 'That departure is not yours.' : cleanDbMessage(error.message), '#departures')
  back(id, 'ok', `Departure cancelled. ${Number(data ?? 0)} booking${Number(data) === 1 ? '' : 's'} refunded in full.`, '#departures')
}

export async function setPackageState(formData: FormData) {
  const id = str(formData, 'id')
  const to = str(formData, 'to') // pause | resume | reopen
  const target = { pause: 'paused', resume: 'published', reopen: 'draft' }[to]
  if (!target) back(id, 'error', 'Unknown action.')
  const { supabase } = await session()
  const { error } = await supabase.from('packages').update({ listing_status: target }).eq('id', id)
  if (error) back(id, 'error', cleanDbMessage(error.message))
  back(id, 'ok', to === 'pause' ? 'Trip paused. Travellers cannot book it until you resume.' : to === 'resume' ? 'Trip is live again.' : 'Trip reopened as a draft.')
}

export async function deleteDraft(formData: FormData) {
  const id = str(formData, 'id')
  const { supabase } = await session()
  const { error } = await supabase.from('packages').delete().eq('id', id)
  if (error) back(id, 'error', 'Only drafts can be deleted.')
  redirect('/seller/packages')
}
