'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SendMessage({ conversationId }: { conversationId: string }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError('')
    setNote('')
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, body: text }) })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(out.error || 'Could not send.')
    if (out.flagged) setNote('We hid some contact details in your message. ZoomFly keeps phone numbers, emails and links private until a trip is paid in full, so everything stays safe and in one place.')
    setText('')
    router.refresh()
  }

  return (
    <form className="form" onSubmit={send} style={{ maxWidth: 'none' }}>
      <div className="field">
        <label htmlFor="msg">Your message</label>
        <textarea id="msg" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} required />
      </div>
      {note && <p className="notice notice--wait" role="status">{note}</p>}
      {error && <p className="field__error" role="alert">{error}</p>}
      <div className="actions"><button className="btn btn--primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send'}</button></div>
    </form>
  )
}
