import Link from 'next/link'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { IconMenu } from '@/components/Icons'

export async function SiteHeader() {
  const profile = await getCurrentProfile()
  let unread = 0
  if (profile) {
    const { data } = await createClient().from('my_conversations').select('unread_count')
    unread = (data ?? []).reduce((n: number, r: { unread_count: number }) => n + (r.unread_count ?? 0), 0)
  }
  const isSeller = profile?.role === 'seller'
  const isAdmin = profile?.role === 'admin'
  const links: { href: string; label: string }[] = [
    { href: '/trips', label: 'Trips' },
    { href: '/destinations', label: 'Destinations' },
    ...(isSeller || isAdmin ? [] : [{ href: '/become-a-seller', label: 'Sell on ZoomFly' }]),
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
    ...(isSeller ? [{ href: '/seller', label: 'Seller area' }, { href: '/seller/packages', label: 'Your trips' }, { href: '/seller/bookings', label: 'Bookings' }] : []),
    ...(profile ? [{ href: '/bookings', label: 'My bookings' }, { href: '/messages', label: `Messages${unread > 0 ? ` (${unread})` : ''}` }, { href: '/account', label: 'Account' }] : []),
  ]
  return (
    <header className="site-header">
      <div className="wrap site-header__bar">
        <Link href="/" className="brand" aria-label="ZoomFly home">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M3 15c4-1 7-4 9-9 2 5 5 8 9 9" /><path d="M12 6v14" /></svg>
          </span>
          ZoomFly
        </Link>

        <nav className="nav" aria-label="Main">
          {links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          {profile ? (
            <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/signup" className="btn btn--primary">Create account</Link>
            </>
          )}
        </nav>

        <details className="menu">
          <summary aria-label="Open menu"><IconMenu /></summary>
          <div className="menu__panel">
            {links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
            {profile ? (
              <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
            ) : (
              <>
                <Link href="/login">Sign in</Link>
                <Link href="/signup" className="btn btn--primary" style={{ marginTop: 6 }}>Create account</Link>
              </>
            )}
          </div>
        </details>
      </div>
    </header>
  )
}
