import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import type { SellerRow } from '@/lib/types'
import { reviewSeller } from '../../actions'

export const metadata: Metadata = { title: 'Review seller' }
export const dynamic = 'force-dynamic'

const FLAGS: [keyof SellerRow, string, string][] = [
  ['gstin_verified', 'GSTIN is active on the GST portal and the legal name matches the business', 'gstin'],
  ['pan_verified', 'PAN belongs to the same business or owner', 'pan'],
  ['bank_verified', 'Bank account name matches the business or owner (cheque checked)', 'bank'],
  ['address_verified', 'Business address is real and matches the GST record', 'address'],
  ['owner_id_verified', 'Owner ID matches the PAN holder', 'id'],
]

export default async function ReviewSeller({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string; error?: string } }) {
  await requireAdmin(`/admin/sellers/${params.id}`)
  const supabase = createClient()
  const { data } = await supabase.from('sellers').select('*').eq('id', params.id).maybeSingle()
  const s = data as SellerRow | null
  if (!s) notFound()

  const sign = async (path: string | null) => {
    if (!path) return null
    const { data } = await supabase.storage.from('seller-documents').createSignedUrl(path, 600) // link works for 10 minutes
    return data?.signedUrl ?? null
  }
  const [cheque, ownerId, travel] = await Promise.all([sign(s.cancelled_cheque_path), sign(s.owner_id_path), sign(s.travel_registration_path)])

  return (
    <div className="wrap page">
      <p className="small"><Link href="/admin/sellers">All seller reviews</Link></p>
      <div className="page__head">
        <h1>{s.business_name}</h1>
        <div className="status-line">
          <span className={s.status === 'approved' ? 'pill pill--approved' : s.status === 'pending' ? 'pill pill--pending' : 'pill pill--bad'}>{s.status}</span>
        </div>
      </div>
      {searchParams.error && <p className="notice notice--error" role="alert">{searchParams.error}</p>}
      {searchParams.saved && <p className="notice notice--ok" role="status">{searchParams.saved === 'approve' ? 'Seller approved.' : searchParams.saved === 'reject' ? 'Seller rejected.' : 'Checks saved.'}</p>}

      <div className="lists">
        <div className="panel">
          <h2>Application</h2>
          <dl className="kv">
            <dt>Contact</dt><dd>{s.contact_name}</dd>
            <dt>Phone</dt><dd>{s.phone}{s.whatsapp ? `, WhatsApp ${s.whatsapp}` : ''}</dd>
            <dt>Email</dt><dd>{s.email}</dd>
            <dt>Address</dt><dd>{s.address}, {s.city}, {s.state} {s.pincode}</dd>
            <dt>GSTIN</dt><dd>{s.gstin}</dd>
            <dt>PAN</dt><dd>{s.pan}</dd>
            <dt>Bank</dt><dd>{s.bank_account_name}, {s.bank_name}<br />A/c {s.bank_account_number}, IFSC {s.bank_ifsc}</dd>
            <dt>Owner ID type</dt><dd>{s.owner_id_type}</dd>
            <dt>Travel registration</dt><dd>{s.travel_registration_number || 'None given'}</dd>
            {s.description && (<><dt>About</dt><dd>{s.description}</dd></>)}
          </dl>
          <h3 style={{ marginTop: 22 }}>Documents</h3>
          <ul className="plain-list">
            <li>{cheque ? <a href={cheque} target="_blank" rel="noopener noreferrer">Cancelled cheque</a> : 'Cancelled cheque: missing'}</li>
            <li>{ownerId ? <a href={ownerId} target="_blank" rel="noopener noreferrer">Owner ID</a> : 'Owner ID: missing'}</li>
            <li>{travel ? <a href={travel} target="_blank" rel="noopener noreferrer">Travel registration</a> : 'Travel registration: not provided'}</li>
          </ul>
          <p className="muted small">Document links expire after 10 minutes. Reload the page for fresh ones.</p>
        </div>

        <form className="panel form" action={reviewSeller}>
          <input type="hidden" name="id" value={s.id} />
          <h2>Checklist</h2>
          {FLAGS.map(([k, text]) => (
            <label key={k} className="check">
              <input type="checkbox" name={k} defaultChecked={Boolean(s[k])} />
              <span>{text}</span>
            </label>
          ))}
          <div className="field">
            <label htmlFor="verification_notes">Notes for the seller</label>
            <textarea id="verification_notes" name="verification_notes" rows={3} defaultValue={s.verification_notes ?? ''} />
            <span className="field__hint">The seller can read this note.</span>
          </div>
          <div className="field">
            <label htmlFor="status_note">Reason (needed to reject)</label>
            <textarea id="status_note" name="status_note" rows={2} defaultValue={s.status === 'rejected' ? s.status_note ?? '' : ''} />
          </div>
          <div className="actions">
            <button className="btn" type="submit" name="decision" value="save">Save checks</button>
            <button className="btn btn--primary" type="submit" name="decision" value="approve">Approve seller</button>
            <button className="btn btn--danger" type="submit" name="decision" value="reject">Reject</button>
          </div>
        </form>
      </div>
    </div>
  )
}
