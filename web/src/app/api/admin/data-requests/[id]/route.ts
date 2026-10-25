import { NextResponse, type NextRequest } from 'next/server'
import { apiUser, fail } from '@/lib/api'
import { kickEmails } from '@/lib/email/drain'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user } = await apiUser()
  if (!user) return fail('Sign in first.', 401)
  const b = await request.json().catch(() => ({}))
  const status = b?.status === 'declined' ? 'declined' : b?.status === 'done' ? 'done' : null
  const note = String(b?.note ?? '').trim().slice(0, 500)
  if (!status) return fail('Choose done or declined.', 400)
  if (status === 'declined' && note.length < 5) return fail('Say why you cannot do it.', 400)
  const { data, error } = await supabase.from('data_requests').update({ status, admin_note: note || null, resolved_at: new Date().toISOString() }).eq('id', params.id).eq('status', 'open').select('id')
  if (error || !data || data.length === 0) return fail('Could not update. It may already be closed, or you are not an admin.', 403)
  await kickEmails()
  return NextResponse.json({ ok: true })
}
