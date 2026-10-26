import Link from 'next/link'
import type { Metadata } from 'next'
import { signUp } from '../actions'
import { Turnstile } from '@/components/Turnstile'

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } }

export default function Signup({ searchParams }: { searchParams: { error?: string; next?: string } }) {
  const next = searchParams.next ?? '/'
  return (
    <div className="wrap page">
      <div className="page__head">
        <h1>Create your account</h1>
        <p className="muted">One account works for booking trips and, later, for selling them.</p>
      </div>
      {searchParams.error && <p className="notice notice--error" role="alert">{searchParams.error}</p>}
      <form className="form" action={signUp}>
        <input type="hidden" name="next" value={next} />
        <div className="field">
          <label htmlFor="full_name">Full name</label>
          <input id="full_name" name="full_name" autoComplete="name" required />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          <span className="field__hint">At least 8 characters.</span>
        </div>
        <label className="check">
          <input type="checkbox" name="terms" required />
          <span>I am 18 or older and I accept the <Link href="/terms">Terms of Use</Link> and the <Link href="/privacy">Privacy Policy</Link>.</span>
        </label>
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <Turnstile />
        <div className="actions">
          <button className="btn btn--primary" type="submit">Create account</button>
        </div>
        <p className="muted">
          Already registered? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
        </p>
      </form>
    </div>
  )
}
