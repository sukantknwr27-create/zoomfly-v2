import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Email-confirmation link lands here: swap the one-time code for a session, then go on.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const raw = searchParams.get('next') ?? '/'
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('That confirmation link is invalid or has expired. Sign in, or create the account again.')}`)
}
