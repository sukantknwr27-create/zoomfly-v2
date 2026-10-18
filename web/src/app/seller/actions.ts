'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/
const MAX_BYTES = 4 * 1024 * 1024
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' }

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const phone10 = (v: string) => v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '')

export async function submitSellerApplication(formData: FormData) {
  const fail = (msg: string): never => redirect(`/seller/apply?error=${encodeURIComponent(msg)}`)
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/seller/apply')

  const { data: existing } = await supabase.from('sellers').select('id').maybeSingle()
  if (existing) redirect('/seller')

  const business_name = str(formData, 'business_name')
  const contact_name = str(formData, 'contact_name')
  const email = str(formData, 'email').toLowerCase()
  const phone = phone10(str(formData, 'phone'))
  const whatsappRaw = str(formData, 'whatsapp')
  const whatsapp = whatsappRaw ? phone10(whatsappRaw) : null
  const city = str(formData, 'city')
  const state = str(formData, 'state')
  const pincode = str(formData, 'pincode')
  const address = str(formData, 'address')
  const description = str(formData, 'description')
  const gstin = str(formData, 'gstin').toUpperCase()
  const pan = str(formData, 'pan').toUpperCase()
  const bank_account_name = str(formData, 'bank_account_name')
  const bank_account_number = str(formData, 'bank_account_number').replace(/\s/g, '')
  const bank_ifsc = str(formData, 'bank_ifsc').toUpperCase()
  const bank_name = str(formData, 'bank_name')
  const owner_id_type = str(formData, 'owner_id_type')
  const travel_registration_number = str(formData, 'travel_registration_number')

  if (!business_name) fail('Enter your business name.')
  if (!contact_name) fail('Enter the contact person’s name.')
  if (!/^\S+@\S+\.\S+$/.test(email)) fail('Enter a valid email address.')
  if (!/^[6-9]\d{9}$/.test(phone)) fail('Enter a 10-digit Indian mobile number for the phone.')
  if (whatsapp && !/^[6-9]\d{9}$/.test(whatsapp)) fail('The WhatsApp number must be a 10-digit Indian mobile number, or leave it empty.')
  if (!city || !state) fail('Enter your city and state.')
  if (!/^\d{6}$/.test(pincode)) fail('Enter a 6-digit pincode.')
  if (address.length < 10) fail('Enter your full business address.')
  if (!GSTIN.test(gstin)) fail('That GSTIN does not look right. It has 15 characters, for example 27ABCDE1234F1Z5.')
  if (!PAN.test(pan)) fail('That PAN does not look right. It has 10 characters, for example ABCDE1234F.')
  if (!bank_account_name || !/^\d{6,20}$/.test(bank_account_number)) fail('Enter the account holder name and a valid account number (digits only).')
  if (!IFSC.test(bank_ifsc)) fail('That IFSC code does not look right. Example: SBIN0001234.')
  if (!bank_name) fail('Enter your bank’s name.')
  if (!owner_id_type) fail('Choose the type of owner ID you are uploading.')

  const files = {
    cheque: formData.get('cancelled_cheque') as File | null,
    ownerId: formData.get('owner_id') as File | null,
    travel: formData.get('travel_registration') as File | null,
  }
  const need = (f: File | null, label: string) => {
    if (!f || f.size === 0) fail(`Upload the ${label}.`)
  }
  need(files.cheque, 'cancelled cheque')
  need(files.ownerId, 'owner ID')
  for (const [f, label] of [[files.cheque, 'Cancelled cheque'], [files.ownerId, 'Owner ID'], [files.travel, 'Travel registration']] as [File | null, string][]) {
    if (f && f.size > 0) {
      if (!TYPES[f.type]) fail(`${label}: upload a JPG, PNG or PDF file.`)
      if (f.size > MAX_BYTES) fail(`${label} is larger than 4 MB. Upload a smaller file.`)
    }
  }

  const uploaded: string[] = []
  const put = async (f: File, kind: string): Promise<string> => {
    const path = `${user.id}/${kind}-${Date.now()}.${TYPES[f.type]}`
    const { error } = await supabase.storage.from('seller-documents').upload(path, f, { contentType: f.type, upsert: false })
    if (error) {
      if (uploaded.length) await supabase.storage.from('seller-documents').remove(uploaded)
      fail('We could not upload your documents. Try again in a minute.')
    }
    uploaded.push(path)
    return path
  }
  const chequePath = await put(files.cheque as File, 'cancelled-cheque')
  const ownerPath = await put(files.ownerId as File, 'owner-id')
  const travelPath = files.travel && files.travel.size > 0 ? await put(files.travel, 'travel-registration') : null

  const { error } = await supabase.from('sellers').insert({
    user_id: user.id, business_name, contact_name, email, phone, whatsapp, city, state, pincode, address,
    description: description || null, gstin, pan, bank_account_name, bank_account_number, bank_ifsc, bank_name,
    cancelled_cheque_path: chequePath, owner_id_type, owner_id_path: ownerPath,
    travel_registration_number: travel_registration_number || null, travel_registration_path: travelPath,
  })
  if (error) {
    await supabase.storage.from('seller-documents').remove(uploaded)
    if (error.code === '23505') fail('A seller account with this GSTIN already exists. If it is yours, sign in with the account you used to apply.')
    if (error.code === '23514') fail('One of the details has an invalid format. Check the GSTIN, PAN and IFSC code.')
    fail('We could not save your application. Check the details and try again.')
  }
  redirect('/seller')
}
