import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { SendMessage } from '@/components/SendMessage'
import { AutoRefresh } from '@/components/AutoRefresh'

export const metadata: Metadata = { title: 'Conversation' }
export const dynamic = 'force-dynamic'

type Conv = { id: string; package_title: string; package_slug: string; seller_name: string; customer_first_name: string; i_am_customer: boolean }
type Msg = { id: string; body: string; sender_role: 'customer' | 'seller'; sender_id: string; created_at: string }

export default async function Thread({ params }: { params: { id: string } }) {
  const user = await requireUser(`/messages/${params.id}`)
  const supabase = createClient()
  const { data: c } = await supabase.from('my_conversations').select('id, package_title, package_slug, seller_name, customer_first_name, i_am_customer').eq('id', params.id).maybeSingle()
  const conv = c as Conv | null
  if (!conv) notFound()
  const { data: m } = await supabase.from('messages').select('id, body, sender_role, sender_id, created_at').eq('conversation_id', conv.id).order('created_at')
  const messages = (m ?? []) as Msg[]
  await supabase.rpc('mark_conversation_read', { p_conversation: conv.id })
  const other = conv.i_am_customer ? conv.seller_name : conv.customer_first_name

  return (
    <div className="wrap page">
      <AutoRefresh seconds={8} />
      <p className="small"><Link href="/messages">All messages</Link></p>
      <div className="page__head">
        <h1>{other}</h1>
        <p className="muted">About <Link href={`/trips/${conv.package_slug}`}>{conv.package_title}</Link>. Phone numbers, emails and links are hidden until a trip is paid in full.</p>
      </div>
      <div className="panel" style={{ marginBottom: 24 }}>
        {messages.length === 0 ? <p className="muted">Say hello. Ask about dates, hotels, pickup points or anything else about the trip.</p> : (
          <div style={{ display: 'grid', gap: 14 }}>
            {messages.map((x) => {
              const mine = x.sender_id === user.id
              return (
                <div key={x.id} style={{ justifySelf: mine ? 'end' : 'start', maxWidth: '75%' }}>
                  <div style={{ background: mine ? 'var(--marigold-soft)' : 'var(--mist)', border: '1.5px solid var(--line)', borderRadius: 10, padding: '10px 14px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{x.body}</div>
                  <div className="muted small" style={{ marginTop: 3, textAlign: mine ? 'right' : 'left' }}>
                    {mine ? 'You' : other}, {new Date(x.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <SendMessage conversationId={conv.id} />
    </div>
  )
}
