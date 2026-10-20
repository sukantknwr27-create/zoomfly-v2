'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { kickEmails } from '@/lib/email/drain'

const FLAGS = ['gstin_verified', 'pan_verified', 'bank_verified', 'address_verified', 'owner_id_verified'] as const

export async function reviewSeller(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const back = (q: string): never => redirect(`/admin/sellers/${id}?${q}`)
  const admin = await requireAdmin(`/admin/sellers/${id}`)
  const decision = String(formData.get('decision') ?? 'save')
  const notes = String(formData.get('verification_notes') ?? '').trim() || null
  const flags = Object.fromEntries(FLAGS.map((f) => [f, formData.get(f) === 'on'])) as Record<(typeof FLAGS)[number], boolean>

  const supabase = createClient()
  const { data: seller } = await supabase.from('sellers').select('id, cancelled_cheque_path, owner_id_path, gstin').eq('id', id).maybeSingle()
  if (!seller) back('error=' + encodeURIComponent('Seller not found.'))

  let patch: Record<string, unknown> = { ...flags, verification_notes: notes }
  if (decision === 'approve') {
    if (!FLAGS.every((f) => flags[f])) back('error=' + encodeURIComponent('Tick all five checks before approving.'))
    if (!seller!.cancelled_cheque_path || !seller!.owner_id_path || !seller!.gstin) back('error=' + encodeURIComponent('A required document is missing.'))
    patch = { ...patch, status: 'approved', status_note: null, approved_at: new Date().toISOString(), approved_by: admin.id }
  } else if (decision === 'reject') {
    const reason = String(formData.get('status_note') ?? '').trim()
    if (reason.length < 10) back('error=' + encodeURIComponent('Write the reason for rejecting, so the seller knows what to fix.'))
    patch = { ...patch, status: 'rejected', status_note: reason }
  }
  const { error } = await supabase.from('sellers').update(patch).eq('id', id)
  if (error) back('error=' + encodeURIComponent('Could not save: ' + error.message))
  await kickEmails()
  back('saved=' + decision)
}
