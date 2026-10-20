'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DisputeForm({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await fetch('/api/disputes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId, reason }) })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(out.error || 'Could not send your report.')
    setReason('')
    router.refresh()
  }
  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="reason">What went wrong?</label>
        <textarea id="reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} maxLength={4000} required />
        <span className="field__hint">We reply within 2 days and aim to settle it within 7. The seller&rsquo;s payout for this trip is paused until we do.</span>
      </div>
      {error && <p className="field__error" role="alert">{error}</p>}
      <div className="actions"><button className="btn btn--danger" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Report a problem'}</button></div>
    </form>
  )
}
