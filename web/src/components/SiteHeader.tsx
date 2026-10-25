import Link from 'next/link'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function SiteHeader() {
  const profile = await getCurrentProfile()
  let unread = 0
  if (profile) {
    const { data } = await createClient().from('my_conversations').select('unread_count')
    unread = (data ?? []).reduce((n: number, r: { unread_count: number }) => n + (r.unread_count ?? 0), 0)
  }
  return (
    <header className="site-header">
      <div className="wrap site-header__bar">
        <Link href="/" className="brand">
          ZoomFly<span className="brand__dot">.</span>
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/">Trips</Link>
          {profile?.role === 'admin' && <Link href="/admin">Admin</Link>}
          {profile?.role === 'seller' || profile?.role === 'admin' ? null : <Link href="/become-a-seller">Sell on ZoomFly</Link>}
          {profile?.role === 'seller' && <Link href="/seller/packages">Your trips</Link>}
          {profile?.role === 'seller' && <Link href="/seller/bookings">Bookings</Link>}
          {profile && <Link href="/bookings">My bookings</Link>}
          {profile && <Link href="/account">Account</Link>}
          {profile && <Link href="/messages">Messages{unread > 0 ? ` (${unread})` : ''}</Link>}
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
