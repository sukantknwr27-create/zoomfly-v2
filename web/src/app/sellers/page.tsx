import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Banner } from '@/components/Banner'
import { IconShield } from '@/components/Icons'

export const metadata: Metadata = { title: 'Verified sellers', description: 'Tour operators approved to sell on ZoomFly.', alternates: { canonical: '/sellers' } }
export const dynamic = 'force-dynamic'

type Seller = { id: string; business_name: string; logo_url: string | null; city: string | null; state: string | null; avg_rating: number | null; review_count: number; is_verified: boolean }

export default async function Sellers() {
  const { data } = await createClient().from('public_sellers').select('id, business_name, logo_url, city, state, avg_rating, review_count, is_verified').order('business_name').limit(200)
  const rows = (data ?? []) as Seller[]
  return (
    <>
      <Banner title="Our sellers" sub="Tour operators approved to sell on ZoomFly." />
      <div className="wrap page">
        {rows.length === 0 ? (
          <div className="panel empty"><p><strong>No sellers are live yet.</strong></p><p className="muted">Run tours? <Link href="/become-a-seller">List your trips</Link>.</p></div>
        ) : (
          <div className="partners">
            {rows.map((s) => (
              <Link key={s.id} href={`/sellers/${s.id}`} className="partner">
                <span className="partner__logo">{s.logo_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.logo_url} alt="" /> : s.business_name.charAt(0)}</span>
                <strong>{s.business_name}</strong>
                {s.city && <span className="muted small">{s.city}{s.state ? `, ${s.state}` : ''}</span>}
                {s.is_verified && <span className="verified"><IconShield />Verified</span>}
                {s.avg_rating !== null && s.review_count > 0 && <span className="small">★ {Number(s.avg_rating).toFixed(1)} ({s.review_count})</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
