'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = { departureId: string; adults: number; children: number; infants: number; defaultName: string; defaultEmail: string; defaultPhone: string }

export function BookingForm({ departureId, adults, children, infants, defaultName, defaultEmail, defaultPhone }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const seatRows = adults + children

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const fd = new FormData(e.currentTarget)
    const travellers = Array.from({ length: seatRows + infants }, (_, i) => ({ name: String(fd.get(`t_name_${i}`) ?? ''), age: String(fd.get(`t_age_${i}`) ?? '') }))
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        departureId, adults, children, infants, travellers,
        contact: { name: fd.get('contact_name'), phone: fd.get('contact_phone'), email: fd.get('contact_email') },
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setBusy(false)
      return setError(json.error || 'Something went wrong. Please try again.')
    }
    router.push(`/bookings/${json.id}`)
  }

  const label = (i: number) => (i < adults ? `Adult ${i + 1}` : i < seatRows ? `Child ${i - adults + 1}` : `Infant ${i - seatRows + 1}`)

  return (
    <form className="form form--wide" onSubmit={onSubmit}>
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      <fieldset className="fieldset">
        <legend>Travellers</legend>
        {Array.from({ length: seatRows + infants }, (_, i) => (
          <div key={i} className="form__grid">
            <div className="field"><label htmlFor={`t_name_${i}`}>{label(i)}: full name</label><input id={`t_name_${i}`} name={`t_name_${i}`} required={i < seatRows} autoComplete="off" /></div>
            <div className="field"><label htmlFor={`t_age_${i}`}>Age</label><input id={`t_age_${i}`} name={`t_age_${i}`} type="number" min={0} max={120} /></div>
          </div>
        ))}
      </fieldset>
      <fieldset className="fieldset">
        <legend>Who should we contact?</legend>
        <div className="form__grid">
          <div className="field"><label htmlFor="contact_name">Name</label><input id="contact_name" name="contact_name" defaultValue={defaultName} required /></div>
          <div className="field"><label htmlFor="contact_phone">Mobile number</label><input id="contact_phone" name="contact_phone" defaultValue={defaultPhone} inputMode="tel" required /></div>
          <div className="field"><label htmlFor="contact_email">Email</label><input id="contact_email" name="contact_email" type="email" defaultValue={defaultEmail} required /></div>
        </div>
        <span className="field__hint">The seller does not get these until your trip is paid in full.</span>
      </fieldset>
      <div className="actions">
        <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? 'Reserving your seats…' : 'Reserve seats and continue to payment'}</button>
      </div>
    </form>
  )
}
