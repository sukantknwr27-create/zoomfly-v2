import type { MetadataRoute } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import { abs } from '@/lib/site'
import { createPublicClient } from '@/lib/supabase/public'


// Lists only what is genuinely live: published trips with open departures, and destinations that have one.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  noStore() // generated on every request: a sitemap frozen at build time would list yesterday's trips
  const now = new Date()
  const fixed: MetadataRoute.Sitemap = ['/', '/destinations', '/how-it-works', '/become-a-seller', '/contact', '/cancellation-and-refunds', '/marketplace-rules'].map((p) => ({ url: abs(p), lastModified: now, changeFrequency: 'weekly', priority: p === '/' ? 1 : 0.5 }))
  try {
    const db = createPublicClient()
    const [{ data: trips }, { data: dests }] = await Promise.all([
      db.from('public_packages').select('slug, created_at').limit(5000),
      db.from('public_destinations').select('slug').limit(1000),
    ])
    return [
      ...fixed,
      ...(dests ?? []).map((d: { slug: string }) => ({ url: abs(`/destinations/${d.slug}`), lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 })),
      ...(trips ?? []).map((t: { slug: string; created_at: string }) => ({ url: abs(`/trips/${t.slug}`), lastModified: new Date(t.created_at), changeFrequency: 'daily' as const, priority: 0.9 })),
    ]
  } catch {
    return fixed
  }
}
