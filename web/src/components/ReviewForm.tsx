'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const FIELDS: [string, string, boolean][] = [
  ['overall', 'Overall experience', true],
  ['matched_listing', 'Did the trip match what was advertised?', true],
  ['value_for_money', 'Value for money', true],
  ['hotel_quality', 'Hotel quality', false],
  ['transport', 'Transport', false],
  ['guide_support', 'Guide and support', false],
]

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = { bookingId, comment: fd.get('comment') }
    for (const [k] of FIELDS) body[k] = fd.get(k) || null
    const res = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(out.error || 'Could not save your review.')
    router.refresh()
  }
  return (
    <form className="form" onSubmit={submit}>
      {FIELDS.map(([k, label, req]) => (
        <div key={k} className="field">
          <label htmlFor={k}>{label}{req ? '' : ' (optional)'}</label>
          <select id={k} name={k} required={req} defaultValue="">
            <option value="" disabled={req}>{req ? 'Choose a rating' : 'Skip'}</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} of 5{n === 5 ? ', excellent' : n === 1 ? ', poor' : ''}</option>)}
          </select>
        </div>
      ))}
      <div className="field"><label htmlFor="comment">Tell other travellers about it</label><textarea id="comment" name="comment" rows={4} maxLength={2000} /></div>
      {error && <p className="field__error" role="alert">{error}</p>}
      <div className="actions"><button className="btn btn--primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Post my review'}</button></div>
    </form>
  )
}
