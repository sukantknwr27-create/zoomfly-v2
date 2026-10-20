'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { kickEmails } from '@/lib/email/drain'

export async function markPaid(formData: FormData) {
  await requireAdmin('/admin/payouts')
  const supabase = createClient()
  const { error } = await supabase.rpc('mark_payout_paid', { p_payout: String(formData.get('id') ?? ''), p_utr: String(formData.get('utr') ?? '') })
  if (!error) await kickEmails()
  redirect(error ? `/admin/payouts?error=${encodeURIComponent(error.message)}` : '/admin/payouts?ok=Marked as paid.')
}
