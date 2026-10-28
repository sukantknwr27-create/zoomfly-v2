import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Banner } from '@/components/Banner'
import { RatingSummary, ReviewList } from '@/components/ReviewBits'
import { IconShield } from '@/components/Icons'
import type { ReviewRow } from '@/lib/reviews'

export const metadata: Metadata = { title: 'Traveller reviews', description: 'Reviews from travellers who completed a trip booked on ZoomFly.', alternates: { canonical: '/reviews' } }
export const dynamic = 'force-dynamic'

export default async function Reviews({ searchParams }: { searchParams: { rating?: string } }) {
  const supabase = createClient()
  const { data } = await supabase.from('public_reviews').select('id, package_id, seller_id, overall, matched_listing, comment, reviewer_first_name, created_at').order('created_at', { ascending: false }).limit(2000)
  const all = (data ?? []) as ReviewRow[]
  const want = ['5', '4', '3', '2', '1'].includes(searchParams.rating ?? '') ? Number(searchParams.rating) : 0
  const rows = (want ? all.filter((r) => Math.round(Number(r.overall)) === want) : all).slice(0, 40)
  const ids = Array.from(new Set(rows.map((r) => r.package_id)))
  const { data: pk } = ids.length ? await supabase.from('public_packages').select('id, title, slug').in('id', ids) : { data: [] }
  const titles = new Map((pk ?? []).map((p: { id: string; title: string; slug: string }) => [p.id, { title: p.title, slug: p.slug }]))
  return (
    <>
      <Banner title="Reviews and trust" sub="Real travellers. Genuine experiences." side={<><h2>Only completed trips</h2><p>Every review here comes from a traveller who completed a trip booked on ZoomFly.</p></>} />
      <div className="wrap page">
        <div className="layout-2">
          <div>
            <nav className="tabs" aria-label="Filter by rating">
              <Link href="/reviews" className={!want ? 'is-on' : undefined}>All reviews ({all.length})</Link>
              {[5, 4, 3, 2, 1].map((n) => <Link key={n} href={`/reviews?rating=${n}`} className={want === n ? 'is-on' : undefined}>{n} ★</Link>)}
            </nav>
            <div className="panel">
              {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>{all.length === 0 ? 'No reviews yet. They appear here after travellers complete their trips.' : 'No reviews with that rating.'}</p> : <ReviewList rows={rows} titles={titles} />}
            </div>
          </div>
          <aside className="rail">
            <div className="panel"><h2>Overall rating</h2><RatingSummary rows={all} /></div>
            <div className="panel">
              <h3>About these reviews</h3>
              <ul className="tick-list tick-list--green">
                <li><IconShield />Only from confirmed, completed bookings</li>
                <li><IconShield />Sellers cannot edit or remove them</li>
                <li><IconShield />Fake or paid reviews lead to removal</li>
              </ul>
              <Link className="link-more" href="/trust">Visit the trust centre</Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
