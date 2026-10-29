import Link from 'next/link'
import { formatDate, formatPaise, nightsLabel } from '@/lib/format'
import type { PublicDeparture, PublicPackage } from '@/lib/types'
import type { SavedInfo } from '@/lib/saved'
import { SaveButton } from '@/components/SaveButton'
import { IconClock, IconCompass, IconPin, IconShield, IconStar } from '@/components/Icons'

// One trip, as a card. Everything shown comes from the database: no invented ratings, counts or urgency.
export function TripCard({ p, next, saved, here }: { p: PublicPackage; next?: PublicDeparture; saved?: SavedInfo; here?: string }) {
  const photo = p.photos?.[0]
  const hasRating = p.rating_avg !== null && p.review_count > 0
  return (
    <div className="cardwrap">
    {saved && <SaveButton packageId={p.id} saved={saved} here={here ?? '/trips'} variant="card" />}
    <Link href={`/trips/${p.slug}`} className="card">
      <div className="card__media">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={`${p.title}, ${p.destination_name ?? ''}`} loading="lazy" />
        ) : (
          <div className="card__nophoto"><IconCompass /></div>
        )}
        {p.destination_name && <span className="card__tag">{p.destination_name}</span>}
      </div>
      <div className="card__body">
        <div className="card__meta">
          {nightsLabel(p.nights, p.duration_days) && <span><IconClock />{nightsLabel(p.nights, p.duration_days)}</span>}
          {p.departure_city && <span><IconPin />From {p.departure_city}</span>}
        </div>
        <h3 className="card__title">{p.title}</h3>
        <div className="card__seller">
          <span>{p.seller_name}</span>
          {p.seller_verified && <span className="verified"><IconShield />Verified</span>}
        </div>
        {hasRating && (
          <span className="card__rating">
            <IconStar />{Number(p.rating_avg).toFixed(1)} <span className="muted" style={{ fontWeight: 500 }}>({p.review_count} {p.review_count === 1 ? 'review' : 'reviews'})</span>
          </span>
        )}
        <div className="card__foot">
          <div className="card__price">
            <small>From</small>
            <b>{formatPaise(next?.price_paise ?? p.price_paise)}</b>
            {p.occupancy_basis && <small>{p.occupancy_basis}</small>}
          </div>
          {next && (
            <div className="card__next">
              <strong>{formatDate(next.departure_date)}</strong>
              <span className={next.seats_left <= 4 ? 'seats seats--few' : 'seats'}>{next.seats_left} {next.seats_left === 1 ? 'seat' : 'seats'} left</span>
            </div>
          )}
        </div>
      </div>
    </Link>
    </div>
  )
}
