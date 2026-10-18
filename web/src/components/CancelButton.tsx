'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CancelButton({ bookingId, summary }: { bookingId: string; summary: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function cancel() {
    if (!window.confirm(`${summary}\n\nCancel this booking?`)) return
    setBusy(true)
    setError('')
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(out.error || 'Could not cancel.')
    router.refresh()
  }

  return (
    <div>
      <button className="btn btn--danger" type="button" onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel this booking'}</button>
      {error && <p className="field__error" role="alert" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  )
}
