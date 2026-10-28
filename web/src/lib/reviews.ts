export type ReviewRow = { id: string; package_id: string; seller_id: string; overall: number; matched_listing: boolean | null; comment: string | null; reviewer_first_name: string; created_at: string }

// Summary computed only from real published reviews.
export function summarize(rows: { overall: number }[]) {
  const count = rows.length
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: rows.filter((r) => Math.round(Number(r.overall)) === n).length }))
  const avg = count ? rows.reduce((a, r) => a + Number(r.overall), 0) / count : null
  return { count, avg, dist }
}
