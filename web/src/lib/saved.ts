import { createClient } from '@/lib/supabase/server'

export type SavedInfo = { signedIn: boolean; ids: Set<string> }

// Which trips the current visitor has saved. Signed-out visitors get an empty set.
export async function getSaved(): Promise<SavedInfo> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { signedIn: false, ids: new Set() }
  const { data } = await supabase.from('saved_packages').select('package_id').eq('user_id', user.id).limit(1000)
  return { signedIn: true, ids: new Set((data ?? []).map((r: { package_id: string }) => r.package_id)) }
}
