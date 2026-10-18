const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function formatPaise(paise: number | string | null | undefined): string {
  if (paise === null || paise === undefined) return ''
  return inr.format(Number(paise) / 100)
}

// Dates arrive as 'YYYY-MM-DD' (no time zone); format them as-is so they never shift by a day.
export function formatDate(d: string | null | undefined, withYear = false): string {
  if (!d) return ''
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  })
}

export function nightsLabel(nights: number | null, days: number | null): string {
  if (nights && days) return `${nights} nights, ${days} days`
  if (days) return `${days} days`
  return ''
}
