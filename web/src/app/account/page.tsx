import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, requireUser } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { updatePassword } from '../actions'
import { changeEmail, createDataRequest, updateProfile } from './actions'

export const metadata: Metadata = { title: 'Your account', robots: { index: false } }
export const dynamic = 'force-dynamic'

const KIND: Record<string, string> = { export: 'Copy of my data', delete: 'Delete my account', correct: 'Correct my data' }

export default async function Account({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const user = await requireUser('/account')
  const profile = await getCurrentProfile()
  const supabase = createClient()
  const { data: reqs } = await supabase.from('data_requests').select('id, kind, status, admin_note, created_at').order('created_at', { ascending: false })
  const requests = (reqs ?? []) as { id: string; kind: string; status: string; admin_note: string | null; created_at: string }[]
  const open = new Set(requests.filter((r) => r.status === 'open').map((r) => r.kind))

  return (
    <div className="wrap page">
      <div className="page__head"><h1>Your account</h1></div>
      {searchParams.error && <p className="notice notice--error" role="alert">{searchParams.error}</p>}
      {searchParams.ok && <p className="notice notice--ok" role="status">{searchParams.ok}</p>}
      <div className="lists" style={{ alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 24 }}>
          <form className="panel form" action={updateProfile}>
            <h2>Your details</h2>
            <div className="field"><label htmlFor="full_name">Full name</label><input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ''} required /></div>
            <div className="field"><label htmlFor="phone">Mobile number</label><input id="phone" name="phone" defaultValue={profile?.phone ?? ''} inputMode="tel" /></div>
            <div className="actions"><button className="btn btn--primary" type="submit">Save</button></div>
          </form>
          <form className="panel form" action={changeEmail}>
            <h2>Email</h2>
            <p className="muted" style={{ margin: 0 }}>Now: {user.email}</p>
            <div className="field"><label htmlFor="email">New email</label><input id="email" name="email" type="email" required /></div>
            <div className="actions"><button className="btn" type="submit">Change email</button></div>
          </form>
          <form className="panel form" action={updatePassword}>
            <input type="hidden" name="return" value="account" />
            <h2>Password</h2>
            <div className="field"><label htmlFor="password">New password</label><input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div>
            <div className="field"><label htmlFor="confirm">Type it again</label><input id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required /></div>
            <div className="actions"><button className="btn" type="submit">Change password</button></div>
          </form>
        </div>
        <div className="panel">
          <h2>Your data</h2>
          <p className="muted">You can ask for a copy of what we hold about you, ask us to correct it, or ask us to delete your account. We reply by email. Some records, such as bookings and tax records, we must keep by law.</p>
          {(['export', 'correct', 'delete'] as const).map((k) => (
            <form key={k} action={createDataRequest} className="form" style={{ gap: 6, marginBottom: 14 }}>
              <input type="hidden" name="kind" value={k} />
              {k !== 'export' && <div className="field"><label htmlFor={`note-${k}`}>{k === 'delete' ? 'Anything we should know? (optional)' : 'What should be corrected?'}</label><textarea id={`note-${k}`} name="note" rows={2} required={k === 'correct'} /></div>}
              <div><button className={k === 'delete' ? 'btn btn--danger' : 'btn'} type="submit" disabled={open.has(k)}>{open.has(k) ? `${KIND[k]}: request open` : KIND[k]}</button></div>
            </form>
          ))}
          {requests.length > 0 && (
            <>
              <h3>Your requests</h3>
              <ul className="dep-list">
                {requests.map((r) => (
                  <li key={r.id}><span>{KIND[r.kind]}, {formatDate(r.created_at.slice(0, 10), true)}</span><span>{r.status === 'open' ? 'Open' : r.status === 'done' ? 'Done' : 'Declined'}{r.admin_note ? `: ${r.admin_note}` : ''}</span></li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
