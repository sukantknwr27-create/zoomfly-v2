import Link from 'next/link'
import type { Metadata } from 'next'
import { getCurrentProfile } from '@/lib/auth'
import { Banner } from '@/components/Banner'
import { IconBag, IconCheck, IconFile, IconShield, IconWallet } from '@/components/Icons'

export const metadata: Metadata = { title: 'Sell your tours on ZoomFly' }
export const dynamic = 'force-dynamic'

export default async function BecomeASeller() {
  const profile = await getCurrentProfile()
  const cta = profile ? (
    <Link className="btn btn--gold" href="/seller/apply">Start your application</Link>
  ) : (
    <div className="actions">
      <Link className="btn btn--gold" href="/signup?next=/seller/apply">Create an account to apply</Link>
      <Link className="btn" href="/login?next=/seller/apply" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,0.6)' }}>I already have an account</Link>
    </div>
  )
  return (
    <>
      <Banner title="List your tours on ZoomFly" sub="Reach travellers who want a verified operator. Registration is free, and ZoomFly earns a commission only when you get a booking.">
        <div style={{ marginTop: 8 }}>{cta}</div>
      </Banner>
      <div className="wrap page">
        <ol className="steps" aria-label="How to get started">
          {[['Apply', 'Business details'], ['Verification', 'Upload documents'], ['Publish a trip', 'Dates and seats'], ['Go live', 'Start getting bookings']].map(([t, sub], i) => (
            <li key={t} className={`step${i === 0 ? ' step--on' : ''}`}><span className="step__n">{i + 1}</span><span>{t}<small>{sub}</small></span></li>
          ))}
        </ol>
        <div className="layout-2">
          <div>
            <div className="cards-2">
              <div className="panel">
                <h2><IconFile className="" /> What we ask for</h2>
                <ul className="tick-list">
                  <li><IconCheck />Your GSTIN and PAN</li>
                  <li><IconCheck />A bank account and a cancelled cheque for payouts</li>
                  <li><IconCheck />Your business address and an ID for the owner</li>
                  <li><IconCheck />A travel registration, if you have one. It earns a Verified Partner badge, but it is not required.</li>
                </ul>
                <p className="muted small" style={{ marginBottom: 0 }}>We check every document before your first listing can go live.</p>
              </div>
              <div className="panel">
                <h2><IconWallet className="" /> How it works</h2>
                <ul className="tick-list">
                  <li><IconCheck />You publish dates and seat counts. Travellers see the seats that are really left.</li>
                  <li><IconCheck />Travellers pay ZoomFly. You are paid in stages as the trip approaches and after it ends.</li>
                  <li><IconCheck />Your contact details are shared with a traveller once they have paid in full.</li>
                  <li><IconCheck />Commission depends on the kind of tour and is shown before you publish.</li>
                </ul>
              </div>
            </div>
            <div className="cards-3" style={{ marginTop: 16 }}>
              <div className="mini"><span className="assure__icon"><IconBag /></span><div><h3>Get bookings</h3><p>Your trips are searchable by destination, date and price.</p></div></div>
              <div className="mini"><span className="assure__icon"><IconWallet /></span><div><h3>No setup fee</h3><p>Registration and listing are free.</p></div></div>
              <div className="mini"><span className="assure__icon"><IconShield /></span><div><h3>Verified badge</h3><p>Show travellers you passed our checks.</p></div></div>
            </div>
          </div>
          <aside className="rail">
            <div className="panel"><h3>Already a seller?</h3><p className="muted">Sign in to manage your trips and bookings.</p><Link className="btn btn--primary btn--block" href="/login?next=/seller">Sign in to the seller area</Link></div>
            <div className="panel"><h3>Questions first?</h3><p className="muted">Read how the marketplace works, or the rules sellers agree to.</p><div className="actions"><Link className="btn" href="/how-it-works">How it works</Link><Link className="btn" href="/seller-agreement">Seller agreement</Link></div></div>
          </aside>
        </div>
      </div>
    </>
  )
}
