import type { ReactNode } from 'react'
import { getCurrentProfile } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import type { NavItem } from '@/components/SideNav'
import { IconAlert, IconBag, IconBuilding, IconChat, IconFile, IconFlag, IconGrid, IconRupee, IconSettings, IconShield, IconUser, IconCompass, IconCalendar, IconLock, IconUsers } from '@/components/Icons'

const IconHeartNav = () => (<svg viewBox="0 0 24 24" className="icon" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.4 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z" /></svg>)

export async function AccountShell({ children }: { children: ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile) return <>{children}</>
  const items: NavItem[] = [
    { href: '/bookings', label: 'My bookings', icon: <IconBag /> },
    { href: '/saved', label: 'Saved trips', icon: <IconHeartNav /> },
    { href: '/messages', label: 'Messages', icon: <IconChat /> },
    { href: '/account', label: 'Account settings', icon: <IconSettings /> },
  ]
  return <Shell title="My account" icon={<IconUser />} items={items}>{children}</Shell>
}

export async function SellerShell({ children }: { children: ReactNode }) {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'seller') return <>{children}</>
  const items: NavItem[] = [
    { href: '/seller', label: 'Overview', icon: <IconGrid />, exact: true },
    { href: '/seller/packages', label: 'Your trips', icon: <IconCompass /> },
    { href: '/seller/bookings', label: 'Bookings', icon: <IconCalendar /> },
    { href: '/messages', label: 'Messages', icon: <IconChat /> },
  ]
  return <Shell title="Seller area" icon={<IconBuilding />} items={items}>{children}</Shell>
}

export async function AdminShell({ children }: { children: ReactNode }) {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'admin') return <>{children}</>
  const items: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: <IconGrid />, exact: true },
    { href: '/admin/sellers', label: 'Sellers', icon: <IconUsers /> },
    { href: '/admin/packages', label: 'Trips', icon: <IconCompass /> },
    { href: '/admin/bookings', label: 'Bookings', icon: <IconBag /> },
    { href: '/admin/disputes', label: 'Disputes', icon: <IconAlert /> },
    { href: '/admin/payouts', label: 'Payouts', icon: <IconRupee /> },
    { href: '/admin/finance', label: 'Finance', icon: <IconFile /> },
    { href: '/admin/destinations', label: 'Destinations', icon: <IconFlag /> },
    { href: '/admin/flags', label: 'Flagged chats', icon: <IconChat /> },
    { href: '/admin/privacy', label: 'Privacy requests', icon: <IconLock /> },
    { href: '/admin/emails', label: 'Emails', icon: <IconFile /> },
    { href: '/admin/health', label: 'Site health', icon: <IconShield /> },
  ]
  return <Shell title="Admin" icon={<IconShield />} items={items}>{children}</Shell>
}
