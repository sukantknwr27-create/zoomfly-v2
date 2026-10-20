'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RetryEmails({ failed }: { failed: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function retry() {
    setBusy(true)
    await fetch('/api/admin/emails/retry', { method: 'POST' })
    setBusy(false)
    router.refresh()
  }
  return <button className="btn" type="button" onClick={retry} disabled={busy || failed === 0}>{busy ? 'Retrying…' : `Retry ${failed} failed`}</button>
}
