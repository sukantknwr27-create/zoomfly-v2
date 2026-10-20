import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { StrikeButton } from '@/components/StrikeButton'

export const metadata: Metadata = { title: 'Flagged messages' }
export const dynamic = 'force-dynamic'

type M = { id: string; body: string; flag_reasons: string[]; sender_role: string; created_at: string; conversations: { seller_id: string; sellers: { business_name: string; strike_count: number; status: string } | { business_name: string; strike_count: number; status: string }[] | null } | { seller_id: string; sellers: { business_name: string; strike_count: number; status: string } | null }[] | null }
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)

export default async function Flags() {
  await requireAdmin('/admin/flags')
  const supabase = createClient()
  const { data } = await supabase
    .from('messages')
    .select('id, body, flag_reasons, sender_role, created_at, conversations(seller_id, sellers(business_name, strike_count, status))')
    .eq('flagged', true)
    .order('created_at', { ascending: false })
    .limit(100)
  const rows = (data ?? []) as unknown as M[]
  const { data: orig } = rows.length ? await supabase.from('message_originals').select('message_id, original').in('message_id', rows.map((r) => r.id)) : { data: [] }
  const originals = new Map((orig ?? []).map((o: { message_id: string; original: string }) => [o.message_id, o.original]))

  return (
    <div className="wrap page">
      <div className="page__head"><h1>Flagged messages</h1><p className="muted">Messages where a phone number, email, link or an off-ZoomFly payment hint was found. The other side only ever saw the masked version.</p></div>
      {rows.length === 0 ? <p className="panel">Nothing flagged.</p> : (
        <table className="table">
          <thead><tr><th>Sent by</th><th>What was written</th><th>Why flagged</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const conv = one(r.conversations)
              const seller = conv ? one(conv.sellers as { business_name: string; strike_count: number; status: string } | null) : null
              return (
                <tr key={r.id}>
                  <td>{r.sender_role === 'seller' ? <strong>{seller?.business_name}</strong> : 'A traveller'}<br /><span className="muted small">{new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span></td>
                  <td style={{ maxWidth: '44ch' }}><div className="small muted">Original</div>{originals.get(r.id)}<div className="small muted" style={{ marginTop: 6 }}>Shown to the other side</div>{r.body}</td>
                  <td>{r.flag_reasons.join(', ')}</td>
                  <td>{r.sender_role === 'seller' && conv && seller ? <><StrikeButton sellerId={conv.seller_id} name={seller.business_name} /><div className="muted small" style={{ marginTop: 6 }}>{seller.strike_count} strike{seller.strike_count === 1 ? '' : 's'}, {seller.status}</div></> : <span className="muted">No action for travellers</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
