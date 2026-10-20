import { NextResponse } from 'next/server'
import { apiUser, fail } from '@/lib/api'
import { kickEmails } from '@/lib/email/drain'

export async function POST() {
  const { supabase, user } = await apiUser()
  if (!user) return fail('Sign in first.', 401)
  // only admins can update the outbox (row-level security); anyone else changes 0 rows
  const { data, error } = await supabase.from('email_outbox').update({ status: 'pending', attempts: 0, send_after: new Date().toISOString(), last_error: null }).eq('status', 'failed').select('id')
  if (error || !data) return fail('Could not retry.', 403)
  if (data.length > 0) await kickEmails()
  return NextResponse.json({ ok: true, retried: data.length })
}
