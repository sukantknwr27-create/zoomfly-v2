'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AdminDisputeActions({ id, status, maxRefundRupees }: { id: string; status: string; maxRefundRupees: number }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [refund, setRefund] = useState('0')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function act(action: 'review' | 'resolve') {
    setBusy(true)
    setError('')
    const res = await fetch(`/api/admin/disputes/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note, refundRupees: Number(refund || 0) }) })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(out.error || 'Failed.')
    router.refresh()
  }
  return (
    <div className="form" style={{ gap: 10 }}>
      {status === 'open' && <div><button className="btn" type="button" disabled={busy} onClick={() => act('review')}>Start reviewing</button></div>}
      <div className="field"><label htmlFor={`note-${id}`}>Resolution note (the parties can read it)</label><textarea id={`note-${id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <div className="field"><label htmlFor={`refund-${id}`}>Refund the traveller, in rupees (up to {maxRefundRupees.toLocaleString('en-IN')})</label><input id={`refund-${id}`} value={refund} onChange={(e) => setRefund(e.target.value)} inputMode="decimal" /><span className="field__hint">It is deducted from the seller&rsquo;s payouts.</span></div>
      {error && <p className="field__error" role="alert">{error}</p>}
      <div><button className="btn btn--primary" type="button" disabled={busy} onClick={() => act('resolve')}>Resolve dispute</button></div>
    </div>
  )
}
