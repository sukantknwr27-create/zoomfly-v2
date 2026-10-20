import 'server-only'

export class EmailError extends Error {
  constructor(message: string, public retryable = true) {
    super(message)
  }
}

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)

export async function sendEmail(opts: { id: string; to: string[]; subject: string; html: string; text: string }): Promise<string> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!key || !from) throw new EmailError('Email is not configured (RESEND_API_KEY / EMAIL_FROM).', true)
  const base = (process.env.RESEND_API_BASE || 'https://api.resend.com').replace(/\/$/, '')
  const res = await fetch(`${base}/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': opts.id },   // a retry can never double-send
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text, ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}) }),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
  if (!res.ok) {
    // 4xx (bad address, validation) will not get better by retrying; 429 and 5xx will
    throw new EmailError(json.message || `Resend error ${res.status}`, res.status === 429 || res.status >= 500)
  }
  return json.id ?? ''
}
