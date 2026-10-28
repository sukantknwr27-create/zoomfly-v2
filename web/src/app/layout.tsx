import type { Metadata } from 'next'
import './globals.css'
import { NOINDEX, SITE_NAME, SITE_URL } from '@/lib/site'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'ZoomFly: trips from verified Indian tour operators', template: '%s | ZoomFly' },
  description: 'Tour packages from GST-registered operators we have checked, with real departure dates, real seat counts and all-in prices.',
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, locale: 'en_IN', type: 'website' },
  twitter: { card: 'summary_large_image' },
  robots: NOINDEX ? { index: false, follow: false } : undefined,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
