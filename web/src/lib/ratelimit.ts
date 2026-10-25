import 'server-only'
import crypto from 'crypto'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// A short, non-reversible id for the caller's network address, so we can limit abuse without storing raw IPs.
export function clientKey(): string {
  const h = headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown'
  return crypto.createHash('sha256').update(ip + (process.env.CRON_SECRET ?? 'zf')).digest('hex').slice(0, 24)
}

export function clientIp(): string {
  const h = headers()
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || ''
}

// true = allowed, false = over the limit. The database counts atomically. If the limiter itself breaks we let the request
// through (and say so in the logs): a broken limiter must never take the site down.
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc('check_rate_limit', { p_key: key, p_max: max, p_window_seconds: windowSeconds })
    if (error) {
      console.error('rate limiter error', error.message)
      return true
    }
    return data === true
  } catch (e) {
    console.error('rate limiter failed', e)
    return true
  }
}
