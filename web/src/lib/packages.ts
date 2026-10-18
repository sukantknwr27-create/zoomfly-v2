import type { DepartureRow, ListingStatus, PackageRow } from './types'

export const STATUS_LABEL: Record<ListingStatus, string> = {
  draft: 'Draft',
  submitted: 'Waiting for review',
  changes_requested: 'Changes needed',
  published: 'Live',
  paused: 'Paused',
  rejected: 'Not accepted',
}

export function statusPill(s: ListingStatus): string {
  if (s === 'published') return 'pill pill--approved'
  if (s === 'submitted' || s === 'draft' || s === 'paused') return 'pill pill--pending'
  return 'pill pill--bad'
}

// Mirrors the database rule (package_missing_fields) so sellers see what is missing before they send.
// The database stays the source of truth: it re-checks on submit.
export function missingFields(p: PackageRow, departures: DepartureRow[], today: string): string[] {
  const m: string[] = []
  if (!p.title?.trim()) m.push('a title')
  if (!p.destination_id) m.push('a destination')
  if (!p.departure_city?.trim()) m.push('the departure city')
  if (!p.duration_days || p.duration_days <= 0) m.push('the number of days')
  if (!p.price_paise || p.price_paise <= 0) m.push('the price')
  if (!p.occupancy_basis?.trim()) m.push('what the price is based on (for example, per person, twin sharing)')
  if (!p.cancellation_policy) m.push('a cancellation policy')
  if (!Array.isArray(p.itinerary) || p.itinerary.length === 0) m.push('the day-by-day plan')
  if (!p.inclusions?.length) m.push('what is included')
  if (!p.exclusions?.length) m.push('what is not included')
  if ((p.photos?.length ?? 0) < 3) m.push(`at least 3 real photos (you have ${p.photos?.length ?? 0})`)
  if (p.high_risk_activities && !p.insurance_provided) m.push('insurance, which is required for high-risk activities')
  if (!departures.some((d) => d.status === 'open' && d.total_seats > d.booked_seats && d.departure_date >= today)) m.push('at least one open future departure with seats')
  return m
}

export const lines = (v: FormDataEntryValue | null): string[] =>
  String(v ?? '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)

export const rupeesToPaise = (v: string): number | null => {
  const n = Number(v.replace(/[,\s₹]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}
