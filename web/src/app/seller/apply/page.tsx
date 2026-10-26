import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { FileUpload } from '@/components/FileUpload'
import type { SellerRow } from '@/lib/types'
import { submitSellerApplication, updateSellerApplication } from '../actions'

export const metadata: Metadata = { title: 'Seller application' }
export const dynamic = 'force-dynamic'

export default async function Apply({ searchParams }: { searchParams: { error?: string; edit?: string } }) {
  const user = await requireUser('/seller/apply')
  const supabase = createClient()
  const { data } = await supabase.from('sellers').select('*').maybeSingle()
  const s = data as SellerRow | null
  const editing = Boolean(s) && searchParams.edit === '1' && (s!.status === 'pending' || s!.status === 'rejected')
  if (s && !editing) redirect('/seller')
  const v = (k: keyof SellerRow) => (s ? String(s[k] ?? '') : '')
  const docHint = (has: boolean, base: string) => (has ? 'A file is already uploaded. Choose a new one only to replace it.' : base)

  return (
    <div className="wrap page">
      <div className="page__head">
        <h1>{editing ? 'Fix your application' : 'Seller application'}</h1>
        <p className="muted">{editing ? (s!.status === 'rejected' ? 'Correct what we mentioned and send it again.' : 'You can still change details while we review them.') : 'It takes about ten minutes. Keep your GSTIN, PAN, a cancelled cheque and an ID for the owner ready.'}</p>
      </div>
      {editing && s!.status === 'rejected' && s!.status_note && <p className="notice notice--wait"><strong>Why it was not approved:</strong> {s!.status_note}</p>}
      {searchParams.error && <p className="notice notice--error" role="alert">{searchParams.error}</p>}
      <form className="form form--wide" action={editing ? updateSellerApplication : submitSellerApplication}>
        <fieldset className="fieldset">
          <legend>Your business</legend>
          <div className="form__grid">
            <div className="field"><label htmlFor="business_name">Business name</label><input id="business_name" name="business_name" defaultValue={v('business_name')} required /></div>
            <div className="field"><label htmlFor="contact_name">Contact person</label><input id="contact_name" name="contact_name" defaultValue={v('contact_name')} required /></div>
            <div className="field"><label htmlFor="email">Business email</label><input id="email" name="email" type="email" defaultValue={s ? s.email : user.email ?? ''} required /></div>
            <div className="field"><label htmlFor="phone">Mobile number</label><input id="phone" name="phone" inputMode="tel" autoComplete="tel" defaultValue={v('phone')} required /></div>
            <div className="field"><label htmlFor="whatsapp">WhatsApp number</label><input id="whatsapp" name="whatsapp" inputMode="tel" defaultValue={v('whatsapp')} /><span className="field__hint">Optional. Shown to travellers only after they have paid in full.</span></div>
            <div className="field"><label htmlFor="city">City</label><input id="city" name="city" defaultValue={v('city')} required /></div>
            <div className="field"><label htmlFor="state">State</label><input id="state" name="state" defaultValue={v('state')} required /></div>
            <div className="field"><label htmlFor="pincode">Pincode</label><input id="pincode" name="pincode" inputMode="numeric" maxLength={6} defaultValue={v('pincode')} required /></div>
          </div>
          <div className="field"><label htmlFor="address">Business address</label><textarea id="address" name="address" rows={3} defaultValue={v('address')} required /></div>
          <div className="field"><label htmlFor="description">About your business</label><textarea id="description" name="description" rows={3} defaultValue={v('description')} /><span className="field__hint">Optional. Travellers see this on your trips: regions you cover, years in business, group sizes.</span></div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Tax details</legend>
          <div className="form__grid">
            <div className="field"><label htmlFor="gstin">GSTIN</label><input id="gstin" name="gstin" maxLength={15} autoCapitalize="characters" defaultValue={v('gstin')} required /></div>
            <div className="field"><label htmlFor="pan">PAN of the business or owner</label><input id="pan" name="pan" maxLength={10} autoCapitalize="characters" defaultValue={v('pan')} required /></div>
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Where we pay you</legend>
          <div className="form__grid">
            <div className="field"><label htmlFor="bank_account_name">Account holder name</label><input id="bank_account_name" name="bank_account_name" defaultValue={v('bank_account_name')} required /></div>
            <div className="field"><label htmlFor="bank_name">Bank name</label><input id="bank_name" name="bank_name" defaultValue={v('bank_name')} required /></div>
            <div className="field"><label htmlFor="bank_account_number">Account number</label><input id="bank_account_number" name="bank_account_number" inputMode="numeric" defaultValue={v('bank_account_number')} required /></div>
            <div className="field"><label htmlFor="bank_ifsc">IFSC code</label><input id="bank_ifsc" name="bank_ifsc" maxLength={11} autoCapitalize="characters" defaultValue={v('bank_ifsc')} required /></div>
          </div>
          <FileUpload id="cancelled_cheque" name="cancelled_cheque_path" label="Cancelled cheque" bucket="seller-documents" userId={user.id} folder="cancelled-cheque"
            accept="image/jpeg,image/png,application/pdf" maxMb={4} required={!s?.cancelled_cheque_path} hint={docHint(Boolean(s?.cancelled_cheque_path), 'JPG, PNG or PDF, up to 4 MB. The account holder name must match the business or its owner.')} />
        </fieldset>

        <fieldset className="fieldset">
          <legend>Owner and registration</legend>
          <div className="form__grid">
            <div className="field">
              <label htmlFor="owner_id_type">Owner ID type</label>
              <select id="owner_id_type" name="owner_id_type" required defaultValue={v('owner_id_type')}>
                <option value="" disabled>Choose one</option>
                <option>Aadhaar</option><option>Passport</option><option>Driving licence</option><option>Voter ID</option>
              </select>
            </div>
            <FileUpload id="owner_id" name="owner_id_path" label="Owner ID file" bucket="seller-documents" userId={user.id} folder="owner-id"
              accept="image/jpeg,image/png,application/pdf" maxMb={4} required={!s?.owner_id_path} hint={docHint(Boolean(s?.owner_id_path), 'JPG, PNG or PDF, up to 4 MB.')} />
            <div className="field"><label htmlFor="travel_registration_number">Travel registration number</label><input id="travel_registration_number" name="travel_registration_number" defaultValue={v('travel_registration_number')} /><span className="field__hint">Optional. Having one earns a Verified Partner badge.</span></div>
            <FileUpload id="travel_registration" name="travel_registration_path" label="Travel registration file" bucket="seller-documents" userId={user.id} folder="travel-registration"
              accept="image/jpeg,image/png,application/pdf" maxMb={4} hint={docHint(Boolean(s?.travel_registration_path), 'Optional.')} />
          </div>
        </fieldset>

        {!editing && (
          <label className="check">
            <input type="checkbox" name="agreement" required />
            <span>I have read and accept the <Link href="/seller-agreement" target="_blank">Seller Agreement</Link> and the <Link href="/marketplace-rules" target="_blank">Marketplace Rules</Link>, and I am authorised to bind this business.</span>
          </label>
        )}
        <div className="actions">
          <button className="btn btn--primary" type="submit">{editing ? (s!.status === 'rejected' ? 'Save and send again' : 'Save changes') : 'Send application'}</button>
        </div>
        <p className="muted small">Your documents are stored privately. Only ZoomFly&rsquo;s review team can open them.</p>
      </form>
    </div>
  )
}
