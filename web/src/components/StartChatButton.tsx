'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function StartChatButton({ packageId }: { packageId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function go() {
    setBusy(true)
    setError('')
    const res = await fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packageId }) })
    const out = await res.json().catch(() => ({}))
    if (!res.ok) {
      setBusy(false)
      return setError(out.error || 'Could not open the chat.')
    }
    router.push(`/messages/${out.id}`)
  }
  return (
    <div>
      <button className="btn" type="button" onClick={go} disabled={busy} style={{ width: '100%' }}>{busy ? 'Opening…' : 'Ask the seller a question'}</button>
      {error && <p className="field__error" role="alert" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  )
}
