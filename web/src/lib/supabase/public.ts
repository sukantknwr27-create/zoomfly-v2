import { createClient } from '@supabase/supabase-js'

// Cookie-free, anonymous client for public data (sitemap, legal pages that quote live rates). No user session involved,
// so these pages and files can be cached and never depend on who is looking.
export function createPublicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next.js caches fetch() by default; these reads must always be fresh (live trips, live policy numbers)
    global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: 'no-store' }) },
  })
}
