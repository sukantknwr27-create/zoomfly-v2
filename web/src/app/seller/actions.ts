'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { kickEmails } from '@/lib/email/drain'
import { allow } from '@/lib/ratelimit'
import { TERMS_VERSION } from '@/lib/site'

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const phone10 = (v: string) => v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '')

// One validator for both "apply" and "fix my application", so the rules can never differ between them.
function parse(fd: FormData, fail: (m: string) => never) {
  const f = {
    business_name: str(fd, 'business_name'), contact_name: str(fd, 'contact_name'), email: str(fd, 'email').toLowerCase(),
    phone: phone10(str(fd, 'phone')), whatsapp: str(fd, 'whatsapp') ? phone10(str(fd, 'whatsapp')) : null,
    city: str(fd, 'city'), state: str(fd, 'state'), pincode: str(fd, 'pincode'), address: str(fd, 'address'), description: str(fd, 'description') || null,
    gstin: str(fd, 'gstin').toUpperCase(), pan: str(fd, 'pan').toUpperCase(),
    bank_account_name: str(fd, 'bank_account_name'), bank_account_number: str(fd, 'bank_account_number').replace(/\s/g, ''),
    bank_ifsc: str(fd, 'bank_ifsc').toUpperCase(), bank_name: str(fd, 'bank_name'), owner_id_type: str(fd, 'owner_id_type'),
    travel_registration_number: str(fd, 'travel_registration_number') || null,
  }
  if (!f.business_name) fail('Enter your business name.')
  if (!f.contact_name) fail('Enter the contact person’s name.')
  if (!/^\S+@\S+\.\S+$/.test(f.email)) fail('Enter a valid email address.')
  if (!/^[6-9]\d{9}$/.test(f.phone)) fail('Enter a 10-digit Indian mobile number for the phone.')
  if (f.whatsapp && !/^[6-9]\d{9}$/.test(f.whatsapp)) fail('The WhatsApp number must be a 10-digit Indian mobile number, or leave it empty.')
  if (!f.city || !f.state) fail('Enter your city and state.')
  if (!/^\d{6}$/.test(f.pincode)) fail('Enter a 6-digit pincode.')
  if (f.address.length < 10) fail('Enter your full business address.')
  if (!GSTIN.test(f.gstin)) fail('That GSTIN does not look right. It has 15 characters, for example 27ABCDE1234F1Z5.')
  if (!PAN.test(f.pan)) fail('That PAN does not look right. It has 10 characters, for example ABCDE1234F.')
  if (!f.bank_account_name || !/^\d{6,20}$/.test(f.bank_account_number)) fail('Enter the account holder name and a valid account number (digits only).')
  if (!IFSC.test(f.bank_ifsc)) fail('That IFSC code does not look right. Example: SBIN0001234.')
  if (!f.bank_name) fail('Enter your bank’s name.')
  if (!f.owner_id_type) fail('Choose the type of owner ID you are uploading.')
  return f
}

export async function submitSellerApplication(formData: FormData) {
  const fail = (msg: string): never => redirect(`/seller/apply?error=${encodeURIComponent(msg)}`)
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/seller/apply')
  const { data: existing } = await supabase.from('sellers').select('id').maybeSingle()
  if (existing) redirect('/seller')
  if (!(await allow(`apply:${user.id}`, 5, 86400))) fail('Too many attempts today. Please try again tomorrow.')

  const f = parse(formData, fail)
  if (formData.get('agreement') !== 'on') fail('Please accept the Seller Agreement and the Marketplace Rules.')

  // Files were uploaded straight from the browser to private storage; we receive only their paths.
  // A path must sit inside the applicant's own folder, so nobody can attach someone else's file.
  const own = (v: string) => v.startsWith(`${user.id}/`) && !v.includes('..')
  const chequePath = str(formData, 'cancelled_cheque_path')
  const ownerPath = str(formData, 'owner_id_path')
  const travelRaw = str(formData, 'travel_registration_path')
  if (!chequePath || !own(chequePath)) fail('Upload the cancelled cheque.')
  if (!ownerPath || !own(ownerPath)) fail('Upload the owner ID.')
  const travelPath = travelRaw && own(travelRaw) ? travelRaw : null
  const uploaded = [chequePath, ownerPath, ...(travelPath ? [travelPath] : [])]

  const { error } = await supabase.from('sellers').insert({
    user_id: user.id, ...f, cancelled_cheque_path: chequePath, owner_id_path: ownerPath, travel_registration_path: travelPath,
    agreement_accepted_at: new Date().toISOString(), agreement_version: TERMS_VERSION,
  })
  if (error) {
    await supabase.storage.from('seller-documents').remove(uploaded)
    if (error.code === '23505') fail('A seller account with this GSTIN already exists. If it is yours, sign in with the account you used to apply.')
    if (error.code === '23514') fail('One of the details has an invalid format. Check the GSTIN, PAN and IFSC code.')
    fail('We could not save your application. Check the details and try again.')
  }
  await kickEmails()
  redirect('/seller')
}

// A seller whose application is waiting or was not approved can correct it. A rejected one goes back into the queue.
export async function updateSellerApplication(formData: FormData) {
  const fail = (msg: string): never => redirect(`/seller/apply?edit=1&error=${encodeURIComponent(msg)}`)
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/seller/apply')
  const { data: existing } = await supabase.from('sellers').select('id, status, cancelled_cheque_path, owner_id_path, travel_registration_path').maybeSingle()
  if (!existing) redirect('/seller/apply')
  if (!['pending', 'rejected'].includes(existing.status)) redirect('/seller')
  if (!(await allow(`apply-edit:${user.id}`, 10, 86400))) fail('Too many changes today. Please try again tomorrow.')

  const f = parse(formData, fail)
  const own = (v: string) => v.startsWith(`${user.id}/`) && !v.includes('..')
  const pick = (name: string, current: string | null) => {
    const v = str(formData, name)
    return v && own(v) ? v : current
  }
  const cheque = pick('cancelled_cheque_path', existing.cancelled_cheque_path)
  const owner = pick('owner_id_path', existing.owner_id_path)
  if (!cheque || !owner) fail('The cancelled cheque and the owner ID are required.')
  const { error } = await supabase.from('sellers').update({
    ...f, cancelled_cheque_path: cheque, owner_id_path: owner, travel_registration_path: pick('travel_registration_path', existing.travel_registration_path),
  }).eq('id', existing.id)
  if (error) fail(error.code === '23505' ? 'Another seller account already uses this GSTIN.' : 'One of the details has an invalid format. Check the GSTIN, PAN and IFSC code.')
  if (existing.status === 'rejected') {
    const { error: e2 } = await supabase.rpc('resubmit_seller_application')
    if (e2) fail('We saved your changes but could not send the application again. Please try once more.')
    await kickEmails()
  }
  redirect('/seller?ok=' + encodeURIComponent(existing.status === 'rejected' ? 'Your application was sent again. We will review it soon.' : 'Your changes were saved.'))
}
