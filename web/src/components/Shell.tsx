import type { ReactNode } from 'react'
import { SideNav, type NavItem } from '@/components/SideNav'

export function Shell({ title, icon, items, children }: { title: string; icon: ReactNode; items: NavItem[]; children: ReactNode }) {
  return (
    <div className="wrap shell">
      <aside className="shell__side" aria-label={title}>
        <div className="shell__title">{icon}{title}</div>
        <SideNav items={items} />
      </aside>
      <div className="shell__main">{children}</div>
    </div>
  )
}
