'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DataRequestActions({ id }: { id: string }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function act(status: 'done' | 'declined') {
    setBusy(true)
    setError('')
    const res = await fetch(`/api/admin/data-requests/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, note }) })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(out.error || 'Failed.')
    router.refresh()
  }
  return (
    <div className="form" style={{ gap: 8 }}>
      <input aria-label="Note to the user" placeholder="Note to the user (needed to decline)" value={note} onChange={(e) => setNote(e.target.value)} style={{ font: 'inherit', padding: '6px 8px', border: '1.5px solid var(--line)', borderRadius: 6 }} />
      {error && <span className="field__error">{error}</span>}
      <div className="actions"><button className="btn btn--primary" type="button" disabled={busy} onClick={() => act('done')} style={{ padding: '4px 12px', fontSize: '0.9rem' }}>Mark done</button><button className="btn" type="button" disabled={busy} onClick={() => act('declined')} style={{ padding: '4px 12px', fontSize: '0.9rem' }}>Decline</button></div>
    </div>
  )
}
