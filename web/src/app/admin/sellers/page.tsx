import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import type { SellerRow } from '@/lib/types'

export const metadata: Metadata = { title: 'Seller reviews' }
export const dynamic = 'force-dynamic'

const TABS = ['pending', 'approved', 'rejected', 'suspended', 'banned'] as const

export default async function AdminSellers({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdmin('/admin/sellers')
  const status = (TABS as readonly string[]).includes(searchParams.status ?? '') ? searchParams.status! : 'pending'
  const supabase = createClient()
  const { data } = await supabase
    .from('sellers')
    .select('id, business_name, contact_name, phone, city, state, gstin, status, created_at')
    .eq('status', status)
    .order('created_at', { ascending: status === 'pending' })
    .limit(100)
  const rows = (data ?? []) as Pick<SellerRow, 'id' | 'business_name' | 'contact_name' | 'phone' | 'city' | 'state' | 'gstin' | 'status' | 'created_at'>[]

  return (
    <div className="wrap page">
      <div className="page__head">
        <h1>Seller reviews</h1>
        <ul className="chips" style={{ marginTop: 14 }}>
          {TABS.map((t) => (
            <li key={t}>
              <Link className="chip" href={`/admin/sellers?status=${t}`} aria-current={status === t ? 'true' : undefined}>
                {t === 'pending' ? 'Waiting for review' : t[0].toUpperCase() + t.slice(1)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {rows.length === 0 ? (
        <p className="panel">Nothing here right now.</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Business</th><th>Contact</th><th>Location</th><th>GSTIN</th><th>Applied</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/sellers/${r.id}`}><strong>{r.business_name}</strong></Link></td>
                <td>{r.contact_name}<br /><span className="muted small">{r.phone}</span></td>
                <td>{r.city}, {r.state}</td>
                <td>{r.gstin}</td>
                <td>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
