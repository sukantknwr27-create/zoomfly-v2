import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Banner } from '@/components/Banner'
import { RatingSummary, ReviewList } from '@/components/ReviewBits'
import { IconBag, IconCheck, IconFile, IconFlag, IconHeadset, IconLock, IconSeat, IconShield, IconTag, IconWallet } from '@/components/Icons'
import type { ReviewRow } from '@/lib/reviews'

export const metadata: Metadata = { title: 'Trust centre', description: 'How ZoomFly checks sellers, protects payments and handles problems.', alternates: { canonical: '/trust' } }
export const dynamic = 'force-dynamic'

type Seller = { id: string; business_name: string; logo_url: string | null; city: string | null; avg_rating: number | null; review_count: number }

export default async function Trust() {
  const supabase = createClient()
  const [{ data: rv }, { data: sl }] = await Promise.all([
    supabase.from('public_reviews').select('id, package_id, seller_id, overall, matched_listing, comment, reviewer_first_name, created_at').order('created_at', { ascending: false }).limit(2000),
    supabase.from('public_sellers').select('id, business_name, logo_url, city, avg_rating, review_count').eq('is_verified', true).order('business_name').limit(12),
  ])
  const reviews = (rv ?? []) as ReviewRow[]
  const sellers = (sl ?? []) as Seller[]
  const pkgIds = Array.from(new Set(reviews.slice(0, 4).map((r) => r.package_id)))
  const { data: pk } = pkgIds.length ? await supabase.from('public_packages').select('id, title, slug').in('id', pkgIds) : { data: [] }
  const titles = new Map((pk ?? []).map((p: { id: string; title: string; slug: string }) => [p.id, { title: p.title, slug: p.slug }]))

  return (
    <>
      <Banner title="Travel with confidence" sub="Your safety, your money and your trust come first.">
        <div className="assure-strip">
          <div><span className="assure__icon"><IconShield /></span><div><strong>Verified sellers</strong><small>Checked before their first trip</small></div></div>
          <div><span className="assure__icon"><IconLock /></span><div><strong>Payments held by ZoomFly</strong><small>Not paid to the seller up front</small></div></div>
          <div><span className="assure__icon"><IconFile /></span><div><strong>Clear policies</strong><small>Cancellation terms shown on every trip</small></div></div>
          <div><span className="assure__icon"><IconHeadset /></span><div><strong>Help with problems</strong><small>Replies within 2 days</small></div></div>
        </div>
      </Banner>

      <div className="wrap page">
        <nav className="tabs" aria-label="On this page">
          <a href="#why">Why book with ZoomFly</a><a href="#verification">How we verify</a><a href="#reviews">Reviews</a><a href="#policies">Policies</a><a href="#report">Report a problem</a>
        </nav>

        <section id="why" style={{ scrollMarginTop: 90 }}>
          <h2>Why book with ZoomFly</h2>
          <div className="cards-3">
            <div className="mini"><span className="assure__icon"><IconShield /></span><div><h3>Verified sellers</h3><p>Only approved, GST-registered operators can list trips.</p></div></div>
            <div className="mini"><span className="assure__icon"><IconWallet /></span><div><h3>You pay ZoomFly</h3><p>The seller is paid in stages as your trip approaches and after it ends.</p></div></div>
            <div className="mini"><span className="assure__icon"><IconSeat /></span><div><h3>Real seats</h3><p>The seat count falls as people book, so it is never inflated.</p></div></div>
            <div className="mini"><span className="assure__icon"><IconTag /></span><div><h3>Prices you can compare</h3><p>Every price is per person, with taxes included or clearly marked.</p></div></div>
            <div className="mini"><span className="assure__icon"><IconFile /></span><div><h3>Transparent policies</h3><p>Refund rules are shown on each trip before you book.</p></div></div>
            <div className="mini"><span className="assure__icon"><IconBag /></span><div><h3>Reviews from travellers</h3><p>Only people who completed the trip can review it.</p></div></div>
          </div>
        </section>

        <section id="verification" className="section" style={{ scrollMarginTop: 90 }}>
          <div className="layout-2">
            <div className="panel">
              <h2>Our verification standards</h2>
              <p>A seller shows the Verified badge only after every one of these checks has passed:</p>
              <ul className="tick-list tick-list--green">
                <li><IconCheck />GSTIN checked</li><li><IconCheck />PAN checked</li><li><IconCheck />Bank account verified</li>
                <li><IconCheck />Business address verified</li><li><IconCheck />Owner ID verified</li>
              </ul>
              <p className="muted small" style={{ marginBottom: 0 }}>Sellers who break the <Link href="/marketplace-rules">marketplace rules</Link> receive strikes, with suspension or removal for serious cases.</p>
            </div>
            <div className="panel">
              <h2>Payment protection</h2>
              <ul className="tick-list tick-list--green">
                <li><IconCheck />You pay a small advance now and the balance later</li>
                <li><IconCheck />ZoomFly holds your money, not the seller</li>
                <li><IconCheck />Refunds follow the policy shown on the trip</li>
              </ul>
              <Link className="link-more" href="/cancellation-and-refunds">Cancellation and refunds</Link>
            </div>
          </div>
        </section>

        {sellers.length > 0 && (
          <section className="section" aria-label="Verified sellers">
            <div className="section__head"><div><h2>Verified sellers</h2><p className="muted">Approved and fully verified.</p></div><Link className="link-more" href="/sellers">View all sellers</Link></div>
            <div className="partners">
              {sellers.map((s) => (
                <Link key={s.id} href={`/sellers/${s.id}`} className="partner">
                  <span className="partner__logo">{s.logo_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.logo_url} alt="" /> : s.business_name.charAt(0)}</span>
                  <strong>{s.business_name}</strong>
                  <span className="verified"><IconShield />Verified</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section id="reviews" className="section" style={{ scrollMarginTop: 90 }}>
          <div className="layout-2">
            <div className="panel">
              <div className="section__head" style={{ marginBottom: 6 }}><h2 style={{ margin: 0 }}>Traveller reviews</h2>{reviews.length > 0 && <Link className="link-more" href="/reviews">Read all reviews</Link>}</div>
              {reviews.length === 0 ? <p className="muted">No reviews yet. They appear here after travellers complete their trips.</p> : <ReviewList rows={reviews.slice(0, 4)} titles={titles} />}
            </div>
            <div className="panel"><h2>What travellers say</h2><RatingSummary rows={reviews} /></div>
          </div>
        </section>

        <section id="policies" className="section" style={{ scrollMarginTop: 90 }}>
          <h2>Policies</h2>
          <div className="cards-3">
            <Link className="mini" href="/cancellation-and-refunds" style={{ textDecoration: 'none' }}><span className="assure__icon"><IconFile /></span><div><h3>Cancellation and refunds</h3><p>What you get back and when.</p></div></Link>
            <Link className="mini" href="/terms" style={{ textDecoration: 'none' }}><span className="assure__icon"><IconFile /></span><div><h3>Terms of use</h3><p>The rules for using ZoomFly.</p></div></Link>
            <Link className="mini" href="/privacy" style={{ textDecoration: 'none' }}><span className="assure__icon"><IconLock /></span><div><h3>Privacy</h3><p>How your data is used and protected.</p></div></Link>
          </div>
        </section>

        <section id="report" className="section" style={{ scrollMarginTop: 90 }}>
          <div className="panel">
            <h2><IconFlag className="" /> Need help or want to report a problem?</h2>
            <p>For anything about a booking, open the booking and use <strong>Report a problem</strong>. It reaches our team directly and starts a 2-day reply clock.</p>
            <div className="actions"><Link className="btn btn--primary" href="/bookings">Go to my bookings</Link><Link className="btn" href="/contact">Contact ZoomFly</Link></div>
          </div>
        </section>
      </div>
    </>
  )
}
