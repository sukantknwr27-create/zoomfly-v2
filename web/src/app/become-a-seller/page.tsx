import Link from 'next/link'
import type { Metadata } from 'next'
import { getCurrentProfile } from '@/lib/auth'

export const metadata: Metadata = { title: 'Sell your tours on ZoomFly' }
export const dynamic = 'force-dynamic'

export default async function BecomeASeller() {
  const profile = await getCurrentProfile()
  return (
    <div className="wrap page">
      <div className="page__head">
        <h1>Sell your tours to travellers who want a verified operator</h1>
        <p className="hero__lead">Registration is free. ZoomFly earns a commission only when you get a booking.</p>
      </div>
      <div className="lists">
        <div>
          <h2>What we ask for</h2>
          <ul className="plain-list">
            <li>Your GSTIN and PAN</li>
            <li>A bank account and a cancelled cheque for payouts</li>
            <li>Your business address and an ID for the owner</li>
            <li>A travel registration, if you have one. It earns a Verified Partner badge, but it is not required.</li>
          </ul>
          <p className="muted">We check every document before your first listing can go live.</p>
        </div>
        <div>
          <h2>How it works</h2>
          <ul className="plain-list">
            <li>You publish dates and seat counts. Travellers see the seats that are really left.</li>
            <li>Travellers pay ZoomFly. You are paid in stages as the trip approaches and after it ends.</li>
            <li>Your contact details are shared with a traveller once they have paid in full.</li>
            <li>Commission depends on the kind of tour and is shown before you publish.</li>
          </ul>
        </div>
      </div>
      <div className="actions" style={{ marginTop: 28 }}>
        {profile ? (
          <Link className="btn btn--primary" href="/seller/apply">Start your application</Link>
        ) : (
          <>
            <Link className="btn btn--primary" href="/signup?next=/seller/apply">Create an account to apply</Link>
            <Link className="btn" href="/login?next=/seller/apply">I already have an account</Link>
          </>
        )}
      </div>
    </div>
  )
}
