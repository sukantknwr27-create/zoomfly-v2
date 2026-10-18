import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Role = 'customer' | 'seller' | 'admin'
export type Profile = { id: string; full_name: string | null; phone: string | null; role: Role }

export async function getCurrentUser() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = createClient()
  const { data } = await supabase.from('profiles').select('id, full_name, phone, role').eq('id', user.id).maybeSingle()
  return (data as Profile | null) ?? null
}

export async function requireUser(next: string) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  return user
}

// Admin pages answer 404 for everyone else, so the admin area is not even discoverable.
export async function requireAdmin(next: string) {
  await requireUser(next)
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') notFound()
  return profile
}
