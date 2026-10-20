'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function StrikeButton({ sellerId, name }: { sellerId: string; name: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function strike() {
    if (!window.confirm(`Issue a strike to ${name} for moving customers off ZoomFly?\n1st strike: warning. 2nd: suspended. 3rd: banned.`)) return
    setBusy(true)
    setError('')
    const res = await fetch('/api/admin/strikes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sellerId, reason: 'off_platform', note: 'Contact details or payment shared in chat' }) })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(out.error || 'Failed.')
    router.refresh()
  }
  return (
    <div>
      <button className="btn btn--danger" type="button" disabled={busy} onClick={strike} style={{ padding: '4px 12px', fontSize: '0.9rem' }}>Issue strike</button>
      {error && <p className="field__error" role="alert">{error}</p>}
    </div>
  )
}
