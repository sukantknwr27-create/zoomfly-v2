'use client'

import Link from 'next/link'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="wrap page">
      <div className="page__head"><h1>Something went wrong on our side</h1></div>
      <p>Sorry about that. Please try again. If you were paying, do not pay twice: check your bookings first, because a payment that went through will show there within a minute.</p>
      {error.digest && <p className="muted small">Reference: {error.digest}</p>}
      <div className="actions"><button className="btn btn--primary" type="button" onClick={reset}>Try again</button><Link className="btn" href="/bookings">Your bookings</Link><Link className="btn" href="/contact">Contact us</Link></div>
    </div>
  )
}
