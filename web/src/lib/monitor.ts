import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Records an error in the database and emails the admin (at most once per context per hour). Never throws.
export async function reportError(context: string, err: unknown, details?: Record<string, unknown>): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[${context}]`, err)
  try {
    await createAdminClient().rpc('report_error', { p_context: context, p_message: message, p_details: details ?? null })
  } catch (e) {
    console.error('reportError itself failed', e)
  }
}
