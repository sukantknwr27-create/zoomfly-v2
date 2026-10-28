import type { ReactNode } from 'react'
import { SellerShell } from '@/components/Shells'

export default function Layout({ children }: { children: ReactNode }) {
  return <SellerShell>{children}</SellerShell>
}
