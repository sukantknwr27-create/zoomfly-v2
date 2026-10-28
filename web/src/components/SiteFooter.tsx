import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/site'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="site-footer__grid">
          <div style={{ maxWidth: '44ch' }}>
            <div className="brand"><span><span className="brand__word">Zoom<i>fly</i></span><span className="brand__tag">TRAVEL MARKETPLACE</span></span></div>
            <p style={{ marginTop: 0 }}>ZoomFly lists tours from GST-registered operators we have checked. We show a trip only when a seller has real seats to sell.</p>
            {CONTACT_EMAIL && <p style={{ margin: 0 }}><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>}
          </div>
          <nav aria-label="More about ZoomFly" className="site-footer__links">
            <h3>ZoomFly</h3>
            <Link href="/trips">Search trips</Link>
            <Link href="/destinations">Destinations</Link>
            <Link href="/trip-planner">Trip planner</Link>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/become-a-seller">Sell on ZoomFly</Link>
            <Link href="/contact">Contact</Link>
          </nav>
          <nav aria-label="Trust" className="site-footer__links">
            <h3>Trust</h3>
            <Link href="/trust">Trust centre</Link>
            <Link href="/reviews">Traveller reviews</Link>
            <Link href="/sellers">Verified sellers</Link>
            <Link href="/trust#report">Report a problem</Link>
          </nav>
          <nav aria-label="Policies" className="site-footer__links">
            <h3>Policies</h3>
            <Link href="/terms">Terms of use</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/cancellation-and-refunds">Cancellation and refunds</Link>
            <Link href="/seller-agreement">Seller agreement</Link>
            <Link href="/marketplace-rules">Marketplace rules</Link>
          </nav>
        </div>
        <div className="site-footer__base">&copy; {new Date().getFullYear()} ZoomFly. Tours are operated by the independent sellers named on each trip.</div>
      </div>
    </footer>
  )
}
