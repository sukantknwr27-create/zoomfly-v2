import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="wrap page">
      <div className="page__head"><h1>We could not find that page</h1></div>
      <p>The trip or page you are looking for may have been removed, or the link may be wrong. Trips close for booking when their dates pass or their seats run out.</p>
      <div className="actions"><Link className="btn btn--primary" href="/trips">See trips you can book</Link><Link className="btn" href="/">Go to the home page</Link></div>
    </div>
  )
}
