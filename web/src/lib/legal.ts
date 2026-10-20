import { formatPaise } from '@/lib/format'
import { createPublicClient } from '@/lib/supabase/public'
import { LEGAL_FINAL } from '@/lib/site'

// A page counts as final only if the switch is on AND no lawyer/CA placeholder is left in it. Forgetting one keeps the banner up.
export const hasPlaceholders = (md: string) => /\[(LAWYER|CA|COMPANY|REGISTERED|GSTIN|DATE|CONTACT|NAME|EMAIL|ADDRESS|Update)[^\]]*\]/.test(md)
export const isDraft = (md: string) => !LEGAL_FINAL || hasPlaceholders(md)

type Tier = { code: string; min_days_before: number; refund_pct: number }

// Describes one policy's tiers in plain words, from the live database rows.
export function describeTiers(tiers: { min_days_before: number; refund_pct: number }[]): string {
  const t = [...tiers].sort((a, b) => b.min_days_before - a.min_days_before)
  const pct = (r: number) => (r === 0 ? 'no refund' : `${r}% refund`)
  if (t.length === 0) return 'no refund'
  if (t.length === 1) return t[0].refund_pct === 0 ? 'no refund at any time' : `${t[0].refund_pct}% refund at any time`
  return t
    .map((x, i) => {
      if (i === 0) return `${pct(x.refund_pct)} if you cancel ${x.min_days_before} or more days before departure`
      const upper = t[i - 1].min_days_before - 1
      return x.min_days_before === 0 ? `${pct(x.refund_pct)} if you cancel less than ${t[i - 1].min_days_before} days before departure` : `${pct(x.refund_pct)} from ${x.min_days_before} to ${upper} days before departure`
    })
    .join('; ')
}

// Replaces {{TOKENS}} in the legal text with the CURRENT numbers from the database, so the published policy can never
// disagree with what the site actually does.
export async function expandTokens(md: string): Promise<string> {
  if (!md.includes('{{')) return md
  const db = createPublicClient()
  const [{ data: codes }, { data: tiers }, { data: rates }, { data: st }] = await Promise.all([
    db.from('cancellation_policy_codes').select('code, label'),
    db.from('cancellation_policy_tiers').select('code, min_days_before, refund_pct'),
    db.from('commission_rates').select('category, label, rate_pct').eq('is_active', true).order('rate_pct'),
    db.from('marketplace_settings').select('*').maybeSingle(),
  ])
  const allTiers = (tiers ?? []) as Tier[]
  const tiersOf = (c: string) => allTiers.filter((x) => x.code === c)
  const order = ['flexible', 'moderate', 'strict']
  const cancellation = (codes ?? [])
    .sort((a: { code: string }, b: { code: string }) => order.indexOf(a.code) - order.indexOf(b.code))
    .map((c: { code: string; label: string }) => `- **${c.label}**: ${describeTiers(tiersOf(c.code))}.`)
    .join('\n')

  let example = ''
  const flex = tiersOf('flexible').sort((a, b) => b.min_days_before - a.min_days_before)
  if (flex.length) {
    const days = flex[0].min_days_before + 3
    example = `*Example: you paid ${formatPaise(1000000)} for a Flexible trip and cancel ${days} days before departure. You get ${flex[0].refund_pct}% back, which is ${formatPaise(1000000 * flex[0].refund_pct / 100)}.*`
  }
  const commission = (rates ?? []).map((r: { label: string; rate_pct: number }) => `- ${r.label}: ${Number(r.rate_pct)}%`).join('\n')
  const s = st as { advance_pct: number; balance_due_days: number; seat_hold_minutes: number; payout_m1_pct: number; payout_m1_days_before: number; payout_m2_pct: number; payout_m2_days_before: number; payout_m3_pct: number; payout_m3_hours_after: number } | null
  const payment = s ? `To confirm a booking you pay an advance of ${s.advance_pct}% of the total. The balance is due ${s.balance_due_days} days before departure. If the trip leaves within ${s.balance_due_days} days, the full amount is due when you book. Your seats are held for ${s.seat_hold_minutes} minutes while you pay.` : ''
  const payouts = s ? `- ${s.payout_m1_pct}% about ${s.payout_m1_days_before} days before departure\n- ${s.payout_m2_pct}% about ${s.payout_m2_days_before} days before departure\n- ${s.payout_m3_pct}% about ${s.payout_m3_hours_after} hours after the trip ends` : ''

  return md
    .replace(/\{\{CANCELLATION_TIERS\}\}/g, cancellation)
    .replace(/\{\{REFUND_EXAMPLE\}\}/g, example)
    .replace(/\{\{COMMISSION_RATES\}\}/g, commission)
    .replace(/\{\{PAYMENT_TERMS\}\}/g, payment)
    .replace(/\{\{PAYOUT_SCHEDULE\}\}/g, payouts)
}
