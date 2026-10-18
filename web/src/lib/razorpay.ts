import 'server-only'
import crypto from 'crypto'

export class PaymentError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

const base = () => (process.env.RAZORPAY_API_BASE || 'https://api.razorpay.com').replace(/\/$/, '')

function creds() {
  const id = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!id || !secret) throw new PaymentError('Payments are not configured yet.', 503)
  return { id, secret }
}
export const razorpayKeyId = () => creds().id

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const { id, secret } = creds()
  const res = await fetch(`${base()}/v1${path}`, {
    method,
    headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as { error?: { description?: string } } & T
  if (!res.ok) throw new PaymentError(json.error?.description || `Razorpay error (${res.status})`, res.status >= 500 ? 502 : 400)
  return json
}

export type RzpOrder = { id: string; amount: number; currency: string; receipt?: string; notes?: Record<string, string> }
export type RzpPayment = { id: string; order_id: string; amount: number; amount_refunded?: number; currency: string; status: string }
export type RzpRefund = { id: string; amount: number; status: string }

export const createOrder = (amountPaise: number, receipt: string, notes: Record<string, string>) =>
  call<RzpOrder>('POST', '/orders', { amount: amountPaise, currency: 'INR', receipt: receipt.slice(0, 40), notes })
export const fetchOrder = (id: string) => call<RzpOrder>('GET', `/orders/${encodeURIComponent(id)}`)
export const fetchPayment = (id: string) => call<RzpPayment>('GET', `/payments/${encodeURIComponent(id)}`)
export const capturePayment = (id: string, amountPaise: number, currency: string) =>
  call<RzpPayment>('POST', `/payments/${encodeURIComponent(id)}/capture`, { amount: amountPaise, currency })
export const refundPayment = (id: string, amountPaise: number, notes: Record<string, string>) =>
  call<RzpRefund>('POST', `/payments/${encodeURIComponent(id)}/refund`, { amount: amountPaise, notes })

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

// Checkout returns signature = HMAC_SHA256(order_id + '|' + payment_id, key_secret)
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const { secret } = creds()
  return safeEqual(crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex'), signature || '')
}

// Webhook signature = HMAC_SHA256(raw request body, webhook secret)
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret || !signature) return false
  return safeEqual(crypto.createHmac('sha256', secret).update(rawBody).digest('hex'), signature)
}
