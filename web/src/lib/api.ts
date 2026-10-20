import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status })

export async function apiUser() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}
