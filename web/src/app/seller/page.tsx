import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import type { SellerRow } from '@/lib/types'

export const metadata: Metadata = { title: 'Seller area' }
export const dynamic = 'force-dynamic'

const CHECKS: [keyof SellerRow, string][] = [
  ['gstin_verified', 'GSTIN checked'],
  ['pan_verified', 'PAN checked'],
  ['bank_verified', 'Bank account checked'],
  ['address_verified', 'Business address checked'],
  ['owner_id_verified', 'Owner ID checked'],
]

export default async function SellerHome({ searchParams }: { searchParams: { ok?: string } }) {
  await requireUser('/seller')
  const supabase = createClient()
  const { data } = await supabase.from('sellers').select('*').maybeSingle()
  const s = data as SellerRow | null
  if (!s) redirect('/seller/apply')

  const pillClass = s.status === 'approved' ? 'pill pill--approved' : s.status === 'pending' ? 'pill pill--pending' : 'pill pill--bad'
  const label = { pending: 'Under review', approved: 'Approved', rejected: 'Not approved', suspended: 'Suspended', banned: 'Removed' }[s.status]
  const allChecked = CHECKS.every(([k]) => s[k])

  return (
    <div className="wrap page">
      <div className="page__head">
        <h1>{s.business_name}</h1>
        <div className="status-line">
          <span className={pillClass}>{label}</span>
          <span className="muted small">Applied {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>

      {searchParams.ok && <p className="notice notice--ok" role="status">{searchParams.ok}</p>}
      {(s.status === 'pending' || s.status === 'rejected') && <p><Link className="btn" href="/seller/apply?edit=1">{s.status === 'rejected' ? 'Fix and send your application again' : 'Edit your application'}</Link></p>}
      {s.status === 'pending' && <p className="notice notice--wait">We are checking your documents. We aim to finish within 2 working days, and we will email you at {s.email}.</p>}
      {s.status === 'approved' && !allChecked && <p className="notice notice--wait">You are approved, but one or more checks are still open. You can list trips once every check below is complete.</p>}
      {s.status === 'approved' && allChecked && (
        <p className="notice notice--ok">
          You are verified and can list trips. <Link href="/seller/packages">Go to your trips</Link>
        </p>
      )}
      {(s.status === 'rejected' || s.status === 'suspended' || s.status === 'banned') && (
        <p className="notice notice--error">
          {s.status_note || 'Contact ZoomFly support to find out why.'}
        </p>
      )}

      <div className="lists">
        <div className="panel">
          <h2>Checks</h2>
          <ul className="checklist">
            {CHECKS.map(([k, text]) => (
              <li key={k}>
                <span className={s[k] ? 'tick tick--on' : 'tick'} aria-hidden="true">{s[k] ? '✓' : ''}</span>
                <span>{text}<span className="sr-only" style={{ position: 'absolute', left: '-9999px' }}>{s[k] ? ': done' : ': not done yet'}</span></span>
              </li>
            ))}
          </ul>
          {s.verification_notes && <p className="muted small" style={{ marginTop: 14 }}>Note from the review team: {s.verification_notes}</p>}
        </div>
        <div className="panel">
          <h2>Your details</h2>
          <dl className="kv">
            <dt>Contact</dt><dd>{s.contact_name}, {s.phone}</dd>
            <dt>Email</dt><dd>{s.email}</dd>
            <dt>Location</dt><dd>{s.city}, {s.state}</dd>
            <dt>GSTIN</dt><dd>{s.gstin}</dd>
            <dt>PAN</dt><dd>{s.pan}</dd>
            <dt>Bank</dt><dd>{s.bank_name}, ending {s.bank_account_number?.slice(-4)}</dd>
          </dl>
        </div>
      </div>
      <p style={{ marginTop: 24 }}><Link href="/">See how your trips will look to travellers</Link></p>
    </div>
  )
}
