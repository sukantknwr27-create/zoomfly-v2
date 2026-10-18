'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

export async function saveDestination(formData: FormData) {
  await requireAdmin('/admin/destinations')
  const name = String(formData.get('name') ?? '').trim()
  const state = String(formData.get('state') ?? '').trim() || null
  const slug = (String(formData.get('slug') ?? '').trim() || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const go = (kind: string, msg: string): never => redirect(`/admin/destinations?${kind}=${encodeURIComponent(msg)}`)
  if (name.length < 2 || !slug) go('error', 'Enter the destination name.')
  const supabase = createClient()
  const { error } = await supabase.from('destinations').insert({ name, state, slug })
  if (error) go('error', error.code === '23505' ? 'A destination with that web address already exists.' : error.message)
  go('ok', `${name} added.`)
}

export async function toggleDestination(formData: FormData) {
  await requireAdmin('/admin/destinations')
  const supabase = createClient()
  await supabase.from('destinations').update({ is_active: formData.get('to') === 'on' }).eq('id', String(formData.get('id')))
  redirect('/admin/destinations')
}
