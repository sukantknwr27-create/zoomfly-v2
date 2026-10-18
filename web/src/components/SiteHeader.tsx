import Link from 'next/link'
import { getCurrentProfile } from '@/lib/auth'

export async function SiteHeader() {
  const profile = await getCurrentProfile()
  return (
    <header className="site-header">
      <div className="wrap site-header__bar">
        <Link href="/" className="brand">
          ZoomFly<span className="brand__dot">.</span>
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/">Trips</Link>
          {profile?.role === 'admin' && <Link href="/admin/sellers">Seller reviews</Link>}
          {profile?.role === 'seller' || profile?.role === 'admin' ? null : <Link href="/become-a-seller">Sell on ZoomFly</Link>}
          {profile?.role === 'seller' && <Link href="/seller">Seller area</Link>}
          {profile ? (
            <form action="/auth/signout" method="post">
              <button type="submit">Sign out</button>
            </form>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/signup" className="btn btn--primary">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
