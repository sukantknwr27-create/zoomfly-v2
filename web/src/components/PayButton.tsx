'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type CheckoutOptions = {
  key: string; amount: number; currency: string; name: string; description: string; order_id: string
  prefill: { name: string; email: string; contact: string }
  theme: { color: string }
  handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void
  modal: { ondismiss: () => void }
}
declare global {
  interface Window { Razorpay?: new (o: CheckoutOptions) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void } }
}

function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export function PayButton({ bookingId, kind, label }: { bookingId: string; kind: 'advance' | 'balance'; label: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function pay() {
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/payments/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId, kind }) })
      const order = await res.json()
      if (!res.ok) throw new Error(order.error || 'Could not start the payment.')
      if (!(await loadCheckout()) || !window.Razorpay) throw new Error('Could not load the payment window. Check your connection and try again.')
      const rzp = new window.Razorpay({
        key: order.keyId, amount: order.amount, currency: 'INR', name: 'ZoomFly', description: order.description, order_id: order.orderId,
        prefill: order.prefill, theme: { color: '#12263a' },
        handler: async (r) => {
          const v = await fetch('/api/payments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId, ...r }) })
          const out = await v.json().catch(() => ({}))
          setBusy(false)
          if (!v.ok) return setError(out.error || 'We are still confirming your payment. Refresh in a minute.')
          router.refresh()
        },
        modal: { ondismiss: () => setBusy(false) },
      })
      rzp.on('payment.failed', (r) => { setBusy(false); setError(r.error?.description || 'The payment did not go through. You can try again.') })
      rzp.open()
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  return (
    <div>
      <button className="btn btn--primary" type="button" onClick={pay} disabled={busy}>{busy ? 'Opening payment…' : label}</button>
      {error && <p className="field__error" role="alert" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  )
}
