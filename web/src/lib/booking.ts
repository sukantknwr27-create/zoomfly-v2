// Display-side helpers. The database (create_booking / cancel_booking) is the source of truth for every amount;
// these only PREVIEW the same rules so people see numbers before they act.
export type Settings = { advance_pct: number; balance_due_days: number; seat_hold_minutes: number }

export function daysUntil(dateStr: string): number {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  return Math.round((Date.parse(dateStr + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000)
}

export function previewAmounts(unitPaise: number, seats: number, departureDate: string, s: Settings) {
  const total = unitPaise * seats
  const payInFull = daysUntil(departureDate) <= s.balance_due_days
  const advance = payInFull ? total : Math.ceil((total * s.advance_pct) / 100)
  return { total, advance, payInFull, balance: total - advance }
}

export function refundPct(tiers: { min_days_before: number; refund_pct: number }[], departureDate: string): number {
  const days = daysUntil(departureDate)
  const sorted = [...tiers].sort((a, b) => b.min_days_before - a.min_days_before)
  for (const t of sorted) if (days >= t.min_days_before) return t.refund_pct
  return 0
}

export const BOOKING_LABEL: Record<string, string> = {
  pending_payment: 'Waiting for payment',
  confirmed: 'Booked',
  fully_paid: 'Paid in full',
  completed: 'Completed',
  cancelled_by_customer: 'Cancelled by you',
  cancelled_by_seller: 'Cancelled by the seller',
  cancelled_by_admin: 'Cancelled by ZoomFly',
  expired: 'Expired, not paid',
}

export function bookingPill(status: string): string {
  if (status === 'confirmed' || status === 'fully_paid' || status === 'completed') return 'pill pill--approved'
  if (status === 'pending_payment') return 'pill pill--pending'
  return 'pill pill--bad'
}
