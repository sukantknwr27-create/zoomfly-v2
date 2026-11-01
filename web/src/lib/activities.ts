export const ACTIVITY_TYPES: [string, string][] = [
  ['water_sports', 'Water sports'], ['adventure', 'Adventure'], ['sightseeing', 'Sightseeing tours'], ['cultural', 'Cultural and heritage'],
  ['food', 'Food and nightlife'], ['wildlife', 'Nature and wildlife'], ['day_trip', 'Day trips'], ['wellness', 'Wellness'], ['other', 'Other'],
]
export const activityTypeLabel = (v: string | null | undefined) => ACTIVITY_TYPES.find(([k]) => k === v)?.[1] ?? ''
export const isActivity = (p: { kind?: string | null }) => p.kind === 'activity'
export const tripPath = (p: { kind?: string | null; slug: string }) => (p.kind === 'activity' ? `/activities/${p.slug}` : `/trips/${p.slug}`)
