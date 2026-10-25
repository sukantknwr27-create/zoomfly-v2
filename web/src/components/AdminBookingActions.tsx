'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = { mode: 'cancel'; bookingId: string; policyPct: number; paidRupees: number } | { mode: 'retry'; refundId: string }

export function AdminBookingActions(props: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pct, setPct] = useState(props.mode === 'cancel' ? String(props.policyPct) : '')
  const [reason, setReason] = useState('')

  async function call(url: string, body: unknown) {
    setBusy(true)
    setError('')
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(out.error || 'Failed.')
    router.refresh()
  }

  if (props.mode === 'retry') {
    return <span style={{ marginLeft: 10 }}><button className="btn" type="button" disabled={busy} onClick={() => call(`/api/admin/refunds/${props.refundId}/retry`, {})} style={{ padding: '2px 10px', fontSize: '0.85rem' }}>Retry</button>{error && <span className="field__error"> {error}</span>}</span>
  }
  return (
    <div className="form" style={{ maxWidth: 520 }}>
      <div className="field"><label htmlFor="pct">Refund, % of what was paid</label><input id="pct" value={pct} onChange={(e) => setPct(e.target.value)} inputMode="numeric" /><span className="field__hint">The trip&rsquo;s own policy would refund {props.policyPct}% today. Use 100 for a cancellation that is not the customer&rsquo;s fault.</span></div>
      <div className="field"><label htmlFor="reason">Reason (the customer and seller are told)</label><input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      {error && <p className="field__error" role="alert">{error}</p>}
      <div><button className="btn btn--danger" type="button" disabled={busy} onClick={() => { if (window.confirm(`Cancel this booking and refund ${pct || 0}% of the ${props.paidRupees.toLocaleString('en-IN')} rupees paid?`)) call(`/api/admin/bookings/${props.bookingId}/cancel`, { refundPct: Number(pct), reason }) }}>Cancel booking</button></div>
    </div>
  )
}
