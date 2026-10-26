import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { updatePassword } from '../actions'

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function Reset({ searchParams }: { searchParams: { error?: string } }) {
  await requireUser('/reset-password') // the emailed link signs you in first; without it you land on sign in
  return (
    <div className="wrap page">
      <div className="page__head"><h1>Choose a new password</h1></div>
      {searchParams.error && <p className="notice notice--error" role="alert">{searchParams.error}</p>}
      <form className="form" action={updatePassword}>
        <div className="field"><label htmlFor="password">New password</label><input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required /><span className="field__hint">At least 8 characters.</span></div>
        <div className="field"><label htmlFor="confirm">Type it again</label><input id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required /></div>
        <div className="actions"><button className="btn btn--primary" type="submit">Save the new password</button></div>
      </form>
    </div>
  )
}
