'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { allow, clientKey } from '@/lib/ratelimit'

const go = (kind: 'ok' | 'error', msg: string): never => redirect(`/account?${kind}=${encodeURIComponent(msg)}`)

async function me() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account')
  return { supabase, user }
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await me()
  const full_name = String(formData.get('full_name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '')
  if (full_name.length < 2) go('error', 'Enter your full name.')
  if (phone && !/^[6-9]\d{9}$/.test(phone)) go('error', 'Enter a 10-digit Indian mobile number, or leave it empty.')
  const { error } = await supabase.from('profiles').update({ full_name, phone: phone || null }).eq('id', user.id)
  if (error) go('error', 'Could not save your details.')
  go('ok', 'Your details were saved.')
}

export async function changeEmail(formData: FormData) {
  const { supabase, user } = await me()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) go('error', 'Enter a valid email address.')
  if (email === (user.email ?? '').toLowerCase()) go('error', 'That is already your email.')
  if (!(await allow(`email-change:${user.id}`, 3, 3600))) go('error', 'Too many attempts. Try again later.')
  const { error } = await supabase.auth.updateUser({ email })
  if (error) go('error', /already/i.test(error.message) ? 'That email is already used by another account.' : 'Could not start the email change.')
  go('ok', 'We sent a confirmation link. Your email changes once you open it.')
}

export async function createDataRequest(formData: FormData) {
  const { supabase } = await me()
  const kind = String(formData.get('kind') ?? '')
  if (!['export', 'delete', 'correct'].includes(kind)) go('error', 'Unknown request.')
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000) || null
  if (!(await allow(`data-req:${clientKey()}`, 10, 86400))) go('error', 'Too many requests today.')
  const { error } = await supabase.from('data_requests').insert({ kind, note })
  if (error) go('error', /already have an open/i.test(error.message) ? 'You already have an open request of this kind. We will get back to you.' : 'Could not send your request.')
  go('ok', 'We have your request and will reply by email.')
}
