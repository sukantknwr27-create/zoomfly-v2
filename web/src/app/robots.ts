import type { MetadataRoute } from 'next'
import { NOINDEX, abs } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  if (NOINDEX) return { rules: { userAgent: '*', disallow: '/' } }   // staging / preview: never indexed
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/seller', '/bookings', '/book', '/messages', '/login', '/signup', '/auth/'] },
    sitemap: abs('/sitemap.xml'),
  }
}
