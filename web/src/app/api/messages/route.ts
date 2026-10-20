import { NextResponse, type NextRequest } from 'next/server'
import { apiUser, fail } from '@/lib/api'
import { kickEmails } from '@/lib/email/drain'

export async function POST(request: NextRequest) {
  const { supabase, user } = await apiUser()
  if (!user) return fail('Sign in first.', 401)
  const b = await request.json().catch(() => ({}))
  const text = String(b?.body ?? '').trim()
  const conversationId = String(b?.conversationId ?? '')
  if (text.length < 1 || text.length > 2000) return fail('Write a message of up to 2000 characters.', 400)
  // The database decides who is sending (from the signed-in user), masks phone numbers, emails and links,
  // and keeps the original for moderators. We send only the text.
  const { data, error } = await supabase.from('messages').insert({ conversation_id: conversationId, body: text }).select('id, body, flagged').single()
  if (error || !data) return fail('You cannot post in that conversation.', 403)
  await kickEmails()
  return NextResponse.json({ id: data.id, flagged: data.flagged, body: data.body })
}
