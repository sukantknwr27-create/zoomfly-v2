import Link from 'next/link'
import { formatDate, formatPaise, nightsLabel } from '@/lib/format'
import type { PublicDeparture, PublicPackage } from '@/lib/types'
import { IconClock, IconCompass, IconPin, IconShield } from '@/components/Icons'
import { Stars } from '@/components/Stars'

// A search result row. Facts come straight from the listing; nothing is invented.
export function TripRow({ p, next, note }: { p: PublicPackage; next?: PublicDeparture; note?: string }) {
  const photo = p.photos?.[0]
  const hasRating = p.rating_avg !== null && p.review_count > 0
  const incl = (p.inclusions ?? []).slice(0, 4)
  return (
    <Link href={`/trips/${p.slug}`} className="rrow">
      <div className="rrow__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo ? <img src={photo} alt={`${p.title}, ${p.destination_name ?? ''}`} loading="lazy" /> : <span className="card__nophoto"><IconCompass /></span>}
        <span className="rrow__kind">Holiday package</span>
      </div>
      <div className="rrow__main">
        <h3 className="rrow__title">{p.title}</h3>
        <div className="rrow__facts">
          {nightsLabel(p.nights, p.duration_days) && <span><IconClock />{nightsLabel(p.nights, p.duration_days)}</span>}
          {p.destination_name && <span><IconPin />{p.destination_name}</span>}
          {p.departure_city && <span>From {p.departure_city}</span>}
        </div>
        <div className="card__seller">
          <span>By {p.seller_name}</span>
          {p.seller_verified && <span className="verified"><IconShield />Verified</span>}
        </div>
        {hasRating && (
          <span className="card__rating"><Stars value={Number(p.rating_avg)} /> {Number(p.rating_avg).toFixed(1)} <span className="muted" style={{ fontWeight: 500 }}>({p.review_count} {p.review_count === 1 ? 'review' : 'reviews'})</span></span>
        )}
        {p.description && <p className="rrow__desc">{p.description}</p>}
        {incl.length > 0 && <ul className="tags">{incl.map((t, i) => <li key={i} className="tag tag--plain">{t}</li>)}</ul>}
      </div>
      <div className="rrow__buy">
        <div className="rrow__price">
          <small>From</small>
          <b>{formatPaise(next?.price_paise ?? p.price_paise)}</b>
          {p.occupancy_basis && <small>{p.occupancy_basis}</small>}
          {note && <small style={{ marginTop: 6, color: 'var(--blue-deep)', fontWeight: 700 }}>{note}</small>}
        </div>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
          {next && (
            <span className="small" style={{ lineHeight: 1.3 }}>
              <strong>{formatDate(next.departure_date)}</strong><br />
              <span className={next.seats_left <= 4 ? 'seats seats--few' : 'seats'}>{next.seats_left} {next.seats_left === 1 ? 'seat' : 'seats'} left</span>
            </span>
          )}
          <span className="btn btn--primary">View package</span>
        </div>
      </div>
    </Link>
  )
}
