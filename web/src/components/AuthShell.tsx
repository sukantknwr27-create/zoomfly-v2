import type { ReactNode } from 'react'
import { BannerArt } from '@/components/Banner'
import { IconLock, IconShield, IconSparkle } from '@/components/Icons'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="wrap" style={{ paddingBottom: 8 }}>
      <div className="auth">
        <div className="auth__promo">
          <BannerArt />
          <div>
            <h2>Travel more. Discover more.</h2>
            <p>One account to book trips from verified operators and keep every booking in one place.</p>
          </div>
          <ul className="tick-list" style={{ color: '#fff' }}>
            <li><IconShield />Sellers verified before their first trip goes live</li>
            <li><IconLock />Your payment is held by ZoomFly, not the seller</li>
            <li><IconSparkle />Real seats and all-in prices</li>
          </ul>
        </div>
        <div className="auth__form">{children}</div>
      </div>
    </div>
  )
}
