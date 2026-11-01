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

// '18:30:00' -> '6:30 PM'
export function formatTime(t: string | null | undefined): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return ''
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m ?? 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export const hoursLabel = (h: number | string | null | undefined): string => {
  const n = Number(h)
  if (!n) return ''
  return `${Number.isInteger(n) ? n : n.toFixed(1)} ${n === 1 ? 'hour' : 'hours'}`
}

// A date, plus the start time when there is one: '10 Nov 2026, 6:30 AM'
export const formatSlot = (d: string | null | undefined, t: string | null | undefined, withYear = false) => `${formatDate(d, withYear)}${t ? `, ${formatTime(t)}` : ''}`
