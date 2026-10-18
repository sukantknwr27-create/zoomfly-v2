'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }

type Props = {
  id: string
  name: string // each uploaded file becomes a hidden input with this name (its storage path)
  label: string
  bucket: 'seller-documents' | 'package-photos'
  userId: string
  folder: string // e.g. 'cancelled-cheque' or '<packageId>'
  accept: string // 'image/jpeg,image/png,application/pdf'
  maxMb: number
  multiple?: boolean
  required?: boolean
  hint?: string
  onBusyChange?: (busy: boolean) => void
}

export function FileUpload({ id, name, label, bucket, userId, folder, accept, maxMb, multiple, required, hint }: Props) {
  const [paths, setPaths] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setError('')
    const allowed = accept.split(',')
    for (const f of files) {
      if (!allowed.includes(f.type)) return setError(`${f.name}: this file type is not allowed. Use ${allowed.map((a) => EXT[a]?.toUpperCase()).join(', ')}.`)
      if (f.size > maxMb * 1024 * 1024) return setError(`${f.name} is larger than ${maxMb} MB. Choose a smaller file.`)
    }
    setBusy(true)
    const supabase = createClient()
    const done: string[] = multiple ? [...paths] : []
    for (const [i, f] of files.entries()) {
      const path = `${userId}/${folder}/${Date.now()}-${i}.${EXT[f.type]}`
      const { error: err } = await supabase.storage.from(bucket).upload(path, f, { contentType: f.type, upsert: false })
      if (err) {
        setBusy(false)
        setPaths(done)
        return setError(`Could not upload ${f.name}. Check your connection and try again.`)
      }
      done.push(path)
    }
    setPaths(done)
    setBusy(false)
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="file" accept={accept} multiple={multiple} onChange={onChange} required={required && paths.length === 0} disabled={busy} />
      {paths.map((p) => (
        <input key={p} type="hidden" name={name} value={p} />
      ))}
      <span className="field__hint" aria-live="polite">
        {busy ? 'Uploading…' : paths.length > 0 ? `${paths.length} ${paths.length === 1 ? 'file' : 'files'} uploaded.` : hint}
      </span>
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
