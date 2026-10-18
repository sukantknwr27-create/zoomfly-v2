'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

export async function reviewPackage(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const back = (kind: 'ok' | 'error', msg: string): never => redirect(`/admin/packages/${id}?${kind}=${encodeURIComponent(msg)}`)
  const admin = await requireAdmin(`/admin/packages/${id}`)
  const decision = String(formData.get('decision') ?? '')
  const category = String(formData.get('commission_category') ?? '') || null
  const note = String(formData.get('review_note') ?? '').trim() || null
  const supabase = createClient()

  let patch: Record<string, unknown>
  if (decision === 'publish') {
    if (!category) back('error', 'Choose the commission category before publishing.')
    patch = { commission_category: category, listing_status: 'published', review_note: null, reviewed_by: admin.id }
  } else if (decision === 'changes') {
    if (!note || note.length < 10) back('error', 'Write what the seller needs to change (at least a sentence).')
    patch = { listing_status: 'changes_requested', review_note: note, reviewed_by: admin.id, commission_category: category }
  } else if (decision === 'reject') {
    if (!note || note.length < 10) back('error', 'Write the reason for rejecting, so the seller understands.')
    patch = { listing_status: 'rejected', review_note: note, reviewed_by: admin.id }
  } else if (decision === 'pause') {
    patch = { listing_status: 'paused', review_note: note }
  } else back('error', 'Unknown action.')
  const { error } = await supabase.from('packages').update(patch!).eq('id', id)
  if (error) back('error', error.message) // e.g. "Package incomplete. Missing: ..." or "Seller is not fully verified"
  back('ok', { publish: 'Published. It is now visible to travellers.', changes: 'Sent back to the seller with your note.', reject: 'Rejected.', pause: 'Paused.' }[decision] ?? 'Saved.')
}
