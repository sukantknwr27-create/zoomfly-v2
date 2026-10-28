import Link from 'next/link'
import { AuthShell } from '@/components/AuthShell'
import type { Metadata } from 'next'
import { requestPasswordReset } from '../actions'
import { Turnstile } from '@/components/Turnstile'

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false } }

export default function Forgot({ searchParams }: { searchParams: { sent?: string; error?: string } }) {
  return (
    <AuthShell>
      <div className="page__head"><h1>Reset your password</h1></div>
      {searchParams.error && <p className="notice notice--error" role="alert">{searchParams.error}</p>}
      {searchParams.sent ? (
        <p className="notice notice--ok" role="status">If there is an account with that email, we have sent a link to reset the password. It may take a minute. Check your spam folder too.</p>
      ) : (
        <form className="form" action={requestPasswordReset}>
          <p className="muted">Enter the email you signed up with and we will send you a link.</p>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <Turnstile />
          <div className="actions"><button className="btn btn--primary" type="submit">Send the link</button></div>
        </form>
      )}
      <p className="muted" style={{ marginTop: 20 }}><Link href="/login">Back to sign in</Link></p>
    </AuthShell>
  )
}
