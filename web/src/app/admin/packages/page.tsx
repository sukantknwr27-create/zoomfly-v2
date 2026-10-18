import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { STATUS_LABEL } from '@/lib/packages'
import type { ListingStatus } from '@/lib/types'

export const metadata: Metadata = { title: 'Trip reviews' }
export const dynamic = 'force-dynamic'

const TABS: ListingStatus[] = ['submitted', 'published', 'changes_requested', 'paused', 'rejected', 'draft']

export default async function AdminPackages({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdmin('/admin/packages')
  const status = (TABS as string[]).includes(searchParams.status ?? '') ? (searchParams.status as ListingStatus) : 'submitted'
  const supabase = createClient()
  const { data } = await supabase
    .from('packages')
    .select('id, title, listing_status, submitted_at, price_paise, sellers(business_name)')
    .eq('listing_status', status)
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .limit(100)
  const rows = (data ?? []) as unknown as { id: string; title: string; submitted_at: string | null; price_paise: number | null; sellers: { business_name: string } | { business_name: string }[] | null }[]
  const seller = (r: (typeof rows)[number]) => (Array.isArray(r.sellers) ? r.sellers[0]?.business_name : r.sellers?.business_name) ?? ''

  return (
    <div className="wrap page">
      <div className="page__head">
        <h1>Trip reviews</h1>
        <ul className="chips" style={{ marginTop: 14 }}>
          {TABS.map((t) => (
            <li key={t}><Link className="chip" href={`/admin/packages?status=${t}`} aria-current={status === t ? 'true' : undefined}>{t === 'submitted' ? 'Waiting for review' : STATUS_LABEL[t]}</Link></li>
          ))}
        </ul>
      </div>
      {rows.length === 0 ? <p className="panel">Nothing here right now.</p> : (
        <table className="table">
          <thead><tr><th>Trip</th><th>Seller</th><th>Sent</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/packages/${r.id}`}><strong>{r.title}</strong></Link></td>
                <td>{seller(r)}</td>
                <td>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
