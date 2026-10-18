import Link from 'next/link'
import type { Metadata } from 'next'
import { signIn } from '../actions'

export const metadata: Metadata = { title: 'Sign in' }

export default function Login({ searchParams }: { searchParams: { error?: string; notice?: string; next?: string } }) {
  const next = searchParams.next ?? '/'
  return (
    <div className="wrap page">
      <div className="page__head">
        <h1>Sign in</h1>
      </div>
      {searchParams.error && <p className="notice notice--error" role="alert">{searchParams.error}</p>}
      {searchParams.notice && <p className="notice notice--ok" role="status">{searchParams.notice}</p>}
      <form className="form" action={signIn}>
        <input type="hidden" name="next" value={next} />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <div className="actions">
          <button className="btn btn--primary" type="submit">Sign in</button>
        </div>
        <p className="muted">
          New to ZoomFly? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
        </p>
      </form>
    </div>
  )
}
