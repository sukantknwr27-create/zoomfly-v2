import { NextResponse, type NextRequest } from 'next/server'
import { apiUser, fail } from '@/lib/api'
import { kickEmails } from '@/lib/email/drain'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user } = await apiUser()
  if (!user) return fail('Sign in first.', 401)
  const b = await request.json().catch(() => ({}))
  if (b?.action === 'review') {
    // row-level security only lets an admin update disputes; anyone else changes 0 rows
    const { data, error } = await supabase.from('disputes').update({ status: 'under_review', first_responded_at: new Date().toISOString() }).eq('id', params.id).eq('status', 'open').select('id')
    if (error || !data || data.length === 0) return fail('Could not update. It may already be under review, or you are not an admin.', 403)
    return NextResponse.json({ ok: true })
  }
  if (b?.action === 'resolve') {
    const rupees = Number(b?.refundRupees ?? 0)
    if (!Number.isFinite(rupees) || rupees < 0) return fail('Enter the refund as a number of rupees, or 0.', 400)
    const { error } = await supabase.rpc('resolve_dispute', { p_dispute: params.id, p_note: String(b?.note ?? ''), p_refund_paise: Math.round(rupees * 100) })
    if (error) return fail(/Not allowed/i.test(error.message) ? 'Only admins can resolve disputes.' : error.message, /Not allowed/i.test(error.message) ? 403 : 400)
    await kickEmails()
    return NextResponse.json({ ok: true })
  }
  return fail('Unknown action.', 400)
}
