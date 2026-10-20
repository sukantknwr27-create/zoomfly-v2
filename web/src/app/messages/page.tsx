import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Messages' }
export const dynamic = 'force-dynamic'

type Conv = { id: string; package_title: string; seller_name: string; customer_first_name: string; i_am_customer: boolean; last_message_at: string | null; last_message_preview: string | null; unread_count: number; created_at: string }

export default async function Messages() {
  await requireUser('/messages')
  const supabase = createClient()
  const { data } = await supabase.from('my_conversations').select('*').order('last_message_at', { ascending: false, nullsFirst: false })
  const rows = (data ?? []) as Conv[]
  return (
    <div className="wrap page">
      <div className="page__head"><h1>Messages</h1></div>
      {rows.length === 0 ? (
        <div className="panel"><p><strong>No conversations yet.</strong></p><p className="muted">Open a trip and choose &ldquo;Ask the seller a question&rdquo; to start one.</p></div>
      ) : (
        <div className="trip-list">
          {rows.map((c) => (
            <Link key={c.id} href={`/messages/${c.id}`} className="trip-row" style={{ gridTemplateColumns: '1fr auto' }}>
              <div>
                <h3 className="trip-row__title">{c.i_am_customer ? c.seller_name : c.customer_first_name}{c.unread_count > 0 && <span className="pill pill--pending" style={{ marginLeft: 10 }}>{c.unread_count} new</span>}</h3>
                <div className="trip-row__meta">About {c.package_title}</div>
                <div className="trip-row__meta">{c.last_message_preview ?? 'No messages yet'}</div>
              </div>
              <div className="trip-row__meta">{c.last_message_at ? new Date(c.last_message_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
