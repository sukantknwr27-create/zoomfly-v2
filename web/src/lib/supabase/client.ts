import { createBrowserClient } from '@supabase/ssr'

// Browser client: used only for direct file uploads to Storage (bypasses the server's request-size limit).
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
