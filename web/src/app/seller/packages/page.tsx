import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { STATUS_LABEL, statusPill } from '@/lib/packages'
import { formatDate, formatPaise } from '@/lib/format'
import type { ListingStatus } from '@/lib/types'

export const metadata: Metadata = { title: 'Your trips' }
export const dynamic = 'force-dynamic'

type Row = { id: string; title: string; slug: string; listing_status: ListingStatus; price_paise: number | null; review_note: string | null; package_departures: { departure_date: string; status: string; total_seats: number; booked_seats: number }[] }

export default async function SellerPackages() {
  await requireUser('/seller/packages')
  const supabase = createClient()
  const { data: seller } = await supabase.from('sellers').select('id, status').maybeSingle()
  if (!seller) redirect('/seller/apply')
  const { data } = await supabase
    .from('packages')
    .select('id, title, slug, listing_status, price_paise, review_note, package_departures(departure_date, status, total_seats, booked_seats)')
    .order('created_at', { ascending: false })
  const rows = (data ?? []) as Row[]
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  return (
    <div className="wrap page">
      <p className="small"><Link href="/seller">Seller area</Link></p>
      <div className="page__head" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h1>Your trips</h1>
        {seller.status === 'approved' && <Link className="btn btn--primary" href="/seller/packages/new">Add a trip</Link>}
      </div>
      {seller.status !== 'approved' && <p className="notice notice--wait">You can add trips once your seller account is approved.</p>}
      {rows.length === 0 ? (
        <div className="panel">
          <p><strong>You have not added a trip yet.</strong></p>
          <p className="muted">Add a trip with its photos and dates. We review it, and it goes live when it is approved.</p>
        </div>
      ) : (
        <table className="table">
          <thead><tr><th>Trip</th><th>Status</th><th>Price</th><th>Open departures</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const open = r.package_departures.filter((d) => d.status === 'open' && d.departure_date >= today)
              const next = open.map((d) => d.departure_date).sort()[0]
              return (
                <tr key={r.id}>
                  <td><Link href={`/seller/packages/${r.id}`}><strong>{r.title}</strong></Link></td>
                  <td>
                    <span className={statusPill(r.listing_status)}>{STATUS_LABEL[r.listing_status]}</span>
                    {r.listing_status === 'changes_requested' && r.review_note && <div className="small muted" style={{ marginTop: 6, maxWidth: '36ch' }}>{r.review_note}</div>}
                  </td>
                  <td>{r.price_paise ? formatPaise(r.price_paise) : <span className="muted">Not set</span>}</td>
                  <td>{open.length === 0 ? <span className="muted">None</span> : <>{open.length}, next {formatDate(next)}</>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
