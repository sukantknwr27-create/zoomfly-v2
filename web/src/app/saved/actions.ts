'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { allow } from '@/lib/ratelimit'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const safeNext = (v: FormDataEntryValue | null) => { const s = typeof v === 'string' ? v : ''; return s.startsWith('/') && !s.startsWith('//') ? s : '/saved' }

// Saves the trip if it is not saved yet, otherwise removes it.
export async function toggleSaved(formData: FormData) {
  const next = safeNext(formData.get('next'))
  const id = String(formData.get('package_id') ?? '')
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  if (!UUID.test(id)) redirect(next)
  if (!(await allow(`save:${user.id}`, 60, 600))) redirect(next)
  const { data: existing } = await supabase.from('saved_packages').select('package_id').eq('user_id', user.id).eq('package_id', id).maybeSingle()
  if (existing) await supabase.from('saved_packages').delete().eq('user_id', user.id).eq('package_id', id)
  else await supabase.from('saved_packages').insert({ user_id: user.id, package_id: id })
  redirect(next)
}
