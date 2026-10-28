'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export type NavItem = { href: string; label: string; icon: ReactNode; exact?: boolean }

export function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname()
  return (
    <nav>
      {items.map((i) => {
        const on = i.exact ? path === i.href : path === i.href || path.startsWith(i.href + '/')
        return (
          <Link key={i.href} href={i.href} aria-current={on ? 'page' : undefined}>
            {i.icon}{i.label}
          </Link>
        )
      })}
    </nav>
  )
}
