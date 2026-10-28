import Link from 'next/link'
import { formatDate } from '@/lib/format'
import type { ReviewRow } from '@/lib/reviews'
import { summarize } from '@/lib/reviews'
import { IconCheck } from '@/components/Icons'
import { Stars } from '@/components/Stars'

export function RatingSummary({ rows }: { rows: { overall: number }[] }) {
  const s = summarize(rows)
  if (!s.count || s.avg === null) return <p className="muted">No reviews yet. Only people who have completed a trip can review it.</p>
  return (
    <div>
      <div className="bigscore"><b>{s.avg.toFixed(1)}</b><span className="muted">/ 5</span><Stars value={s.avg} /></div>
      <p className="muted small" style={{ marginBottom: 14 }}>Based on {s.count} verified {s.count === 1 ? 'review' : 'reviews'}</p>
      <div className="bars">
        {s.dist.map((d) => (
          <div className="bar" key={d.n}>
            <span>{d.n} ★</span>
            <i><b style={{ width: `${Math.round((d.c / s.count) * 100)}%` }} /></i>
            <span>{Math.round((d.c / s.count) * 100)}% ({d.c})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ReviewList({ rows, titles }: { rows: ReviewRow[]; titles?: Map<string, { title: string; slug: string }> }) {
  return (
    <div>
      {rows.map((r) => {
        const t = titles?.get(r.package_id)
        return (
          <article className="review" key={r.id}>
            <div className="review__head">
              {t ? <Link href={`/trips/${t.slug}`}>{t.title}</Link> : <strong>{r.reviewer_first_name}</strong>}
              <span className="verified"><IconCheck />Verified booking</span>
            </div>
            <div><Stars value={Number(r.overall)} /> <span className="muted small">{t ? `${r.reviewer_first_name}, ` : ''}{formatDate(r.created_at.slice(0, 10), true)}</span></div>
            {r.comment && <p style={{ margin: 0 }}>{r.comment}</p>}
            {r.matched_listing === false && <p className="small muted" style={{ margin: 0 }}>The traveller said the trip did not fully match its listing.</p>}
          </article>
        )
      })}
    </div>
  )
}
