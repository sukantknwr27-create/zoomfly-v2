import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/site'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__row">
        <div style={{ maxWidth: '46ch' }}>
          <p style={{ marginTop: 0 }}>ZoomFly lists tours from GST-registered operators we have checked. We show a trip only when a seller has real seats to sell.</p>
          {CONTACT_EMAIL && <p style={{ margin: 0 }}><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>}
        </div>
        <nav aria-label="More about ZoomFly" style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/destinations">Destinations</Link>
          <Link href="/become-a-seller">Sell on ZoomFly</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <nav aria-label="Policies" style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
          <Link href="/terms">Terms of use</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/cancellation-and-refunds">Cancellation and refunds</Link>
          <Link href="/seller-agreement">Seller agreement</Link>
          <Link href="/marketplace-rules">Marketplace rules</Link>
        </nav>
      </div>
    </footer>
  )
}
