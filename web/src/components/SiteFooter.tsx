import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__row">
        <p style={{ margin: 0, maxWidth: '46ch' }}>
          ZoomFly lists tours from GST-registered operators we have checked. We show a trip only when a seller has real seats to sell.
        </p>
        <p style={{ margin: 0 }}>
          <Link href="/become-a-seller">Sell on ZoomFly</Link>
        </p>
      </div>
    </footer>
  )
}
