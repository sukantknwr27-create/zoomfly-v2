import { NextResponse, type NextRequest } from 'next/server'
import { apiUser, fail } from '@/lib/api'
import { allow } from '@/lib/ratelimit'

export async function POST(request: NextRequest) {
  const { supabase, user } = await apiUser()
  if (!user) return fail('Sign in to message the seller.', 401)
  if (!(await allow(`conv:${user.id}`, 30, 86400))) return fail('You have started many conversations today. Please try again tomorrow.', 429)
  const body = await request.json().catch(() => ({}))
  const { data, error } = await supabase.rpc('start_conversation', { p_package: String(body?.packageId ?? '') })
  if (error) return fail(/own package/i.test(error.message) ? 'You cannot message your own trip.' : /not available/i.test(error.message) ? 'That trip is not available.' : 'Could not start the conversation.', 400)
  return NextResponse.json({ id: data })
}
