import Link from 'next/link'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { IconBell, IconMenu, IconSparkle } from '@/components/Icons'

export async function SiteHeader() {
  const profile = await getCurrentProfile()
  let unread = 0
  if (profile) {
    const { data } = await createClient().from('my_conversations').select('unread_count')
    unread = (data ?? []).reduce((n: number, r: { unread_count: number }) => n + (r.unread_count ?? 0), 0)
  }
  const isSeller = profile?.role === 'seller'
  const isAdmin = profile?.role === 'admin'
  const main = [
    { href: '/destinations', label: 'Destinations' },
    { href: '/trips', label: 'Holiday packages' },
    { href: '/trust', label: 'Trust centre' },
    ...(isSeller || isAdmin ? [] : [{ href: '/become-a-seller', label: 'Sell on ZoomFly' }]),
  ]
  const mine = profile
    ? [
        { href: '/bookings', label: 'My bookings' },
        { href: '/saved', label: 'Saved trips' },
        { href: '/messages', label: `Messages${unread > 0 ? ` (${unread})` : ''}` },
        ...(isSeller ? [{ href: '/seller', label: 'Seller area' }, { href: '/seller/packages', label: 'Your trips' }] : []),
        ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
        { href: '/account', label: 'Account settings' },
      ]
    : []
  const initial = (profile?.full_name ?? 'Z').trim().charAt(0).toUpperCase()
  const first = (profile?.full_name ?? '').trim().split(' ')[0]
  return (
    <header className="site-header">
      <div className="wrap site-header__bar">
        <Link href="/" className="brand" aria-label="ZoomFly home">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M3 15c4-1 7-4 9-9 2 5 5 8 9 9" /><path d="M12 6v14" /></svg>
          </span>
          <span><span className="brand__word">Zoom<i>fly</i></span><span className="brand__tag">TRAVEL MARKETPLACE</span></span>
        </Link>

        <nav className="nav" aria-label="Main">
          {main.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
        </nav>

        <div className="nav-right nav">
          <Link href="/trip-planner" className="nav-pill"><IconSparkle />Trip planner</Link>
          {profile ? (
            <>
              <Link href="/messages" className="iconbtn" aria-label={unread > 0 ? `Messages, ${unread} unread` : 'Messages'}>
                <IconBell />{unread > 0 && <span className="iconbtn__badge">{unread}</span>}
              </Link>
              <details className="me">
                <summary><span className="avatar" aria-hidden="true">{initial}</span>{first}</summary>
                <div className="me__panel">
                  {mine.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
                  <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/signup" className="btn btn--primary">Sign up</Link>
            </>
          )}
        </div>

        <details className="menu">
          <summary aria-label="Open menu"><IconMenu /></summary>
          <div className="menu__panel">
            {main.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
            <Link href="/trip-planner">Trip planner</Link>
            {mine.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
            {profile ? (
              <form action="/auth/signout" method="post"><button type="submit">Sign out</button></form>
            ) : (
              <>
                <Link href="/login">Sign in</Link>
                <Link href="/signup" className="btn btn--primary" style={{ marginTop: 6 }}>Sign up</Link>
              </>
            )}
          </div>
        </details>
      </div>
    </header>
  )
}
