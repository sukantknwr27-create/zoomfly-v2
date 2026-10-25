import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { DataRequestActions } from '@/components/DataRequestActions'

export const metadata: Metadata = { title: 'Privacy requests', robots: { index: false } }
export const dynamic = 'force-dynamic'
const KIND: Record<string, string> = { export: 'Wants a copy of their data', delete: 'Wants their account deleted', correct: 'Wants their data corrected' }

export default async function Privacy() {
  await requireAdmin('/admin/privacy')
  const supabase = createClient()
  const { data } = await supabase.from('data_requests').select('id, kind, note, status, admin_note, created_at, profiles(full_name, phone)').order('created_at', { ascending: false }).limit(100)
  type R = { id: string; kind: string; note: string | null; status: string; admin_note: string | null; created_at: string; profiles: { full_name: string | null; phone: string | null } | { full_name: string | null; phone: string | null }[] | null }
  const rows = (data ?? []) as unknown as R[]
  return (
    <div className="wrap page">
      <p className="small"><Link href="/admin">Admin</Link></p>
      <div className="page__head"><h1>Privacy requests</h1><p className="muted">Answer within the time your Privacy Policy promises. Keep what the law requires you to keep (bookings, tax records) and say so in the note.</p></div>
      {rows.length === 0 ? <p className="panel">No requests.</p> : (
        <table className="table">
          <thead><tr><th>Who</th><th>Request</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
              return (
                <tr key={r.id}>
                  <td><strong>{p?.full_name}</strong><br /><span className="muted small">{p?.phone}<br />{formatDate(r.created_at.slice(0, 10), true)}</span></td>
                  <td>{KIND[r.kind]}{r.note && <div className="muted small" style={{ marginTop: 4 }}>“{r.note}”</div>}</td>
                  <td>{r.status === 'open' ? <DataRequestActions id={r.id} /> : <>{r.status}{r.admin_note ? <div className="muted small">{r.admin_note}</div> : null}</>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
