import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { FileUpload } from '@/components/FileUpload'
import { submitSellerApplication } from '../actions'

export const metadata: Metadata = { title: 'Seller application' }
export const dynamic = 'force-dynamic'

export default async function Apply({ searchParams }: { searchParams: { error?: string } }) {
  const user = await requireUser('/seller/apply')
  const supabase = createClient()
  const { data: existing } = await supabase.from('sellers').select('id').maybeSingle()
  if (existing) redirect('/seller')

  return (
    <div className="wrap page">
      <div className="page__head">
        <h1>Seller application</h1>
        <p className="muted">It takes about ten minutes. Keep your GSTIN, PAN, a cancelled cheque and an ID for the owner ready.</p>
      </div>
      {searchParams.error && <p className="notice notice--error" role="alert">{searchParams.error}</p>}
      <form className="form form--wide" action={submitSellerApplication}>
        <fieldset className="fieldset">
          <legend>Your business</legend>
          <div className="form__grid">
            <div className="field"><label htmlFor="business_name">Business name</label><input id="business_name" name="business_name" required /></div>
            <div className="field"><label htmlFor="contact_name">Contact person</label><input id="contact_name" name="contact_name" required /></div>
            <div className="field"><label htmlFor="email">Business email</label><input id="email" name="email" type="email" defaultValue={user.email ?? ''} required /></div>
            <div className="field"><label htmlFor="phone">Mobile number</label><input id="phone" name="phone" inputMode="tel" autoComplete="tel" required /></div>
            <div className="field"><label htmlFor="whatsapp">WhatsApp number</label><input id="whatsapp" name="whatsapp" inputMode="tel" /><span className="field__hint">Optional. Shown to travellers only after they have paid in full.</span></div>
            <div className="field"><label htmlFor="city">City</label><input id="city" name="city" required /></div>
            <div className="field"><label htmlFor="state">State</label><input id="state" name="state" required /></div>
            <div className="field"><label htmlFor="pincode">Pincode</label><input id="pincode" name="pincode" inputMode="numeric" maxLength={6} required /></div>
          </div>
          <div className="field"><label htmlFor="address">Business address</label><textarea id="address" name="address" rows={3} required /></div>
          <div className="field"><label htmlFor="description">About your business</label><textarea id="description" name="description" rows={3} /><span className="field__hint">Optional. Travellers see this on your trips: regions you cover, years in business, group sizes.</span></div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Tax details</legend>
          <div className="form__grid">
            <div className="field"><label htmlFor="gstin">GSTIN</label><input id="gstin" name="gstin" maxLength={15} autoCapitalize="characters" required /></div>
            <div className="field"><label htmlFor="pan">PAN of the business or owner</label><input id="pan" name="pan" maxLength={10} autoCapitalize="characters" required /></div>
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Where we pay you</legend>
          <div className="form__grid">
            <div className="field"><label htmlFor="bank_account_name">Account holder name</label><input id="bank_account_name" name="bank_account_name" required /></div>
            <div className="field"><label htmlFor="bank_name">Bank name</label><input id="bank_name" name="bank_name" required /></div>
            <div className="field"><label htmlFor="bank_account_number">Account number</label><input id="bank_account_number" name="bank_account_number" inputMode="numeric" required /></div>
            <div className="field"><label htmlFor="bank_ifsc">IFSC code</label><input id="bank_ifsc" name="bank_ifsc" maxLength={11} autoCapitalize="characters" required /></div>
          </div>
          <FileUpload id="cancelled_cheque" name="cancelled_cheque_path" label="Cancelled cheque" bucket="seller-documents" userId={user.id} folder="cancelled-cheque"
            accept="image/jpeg,image/png,application/pdf" maxMb={4} required hint="JPG, PNG or PDF, up to 4 MB. The account holder name must match the business or its owner." />
        </fieldset>

        <fieldset className="fieldset">
          <legend>Owner and registration</legend>
          <div className="form__grid">
            <div className="field">
              <label htmlFor="owner_id_type">Owner ID type</label>
              <select id="owner_id_type" name="owner_id_type" required defaultValue="">
                <option value="" disabled>Choose one</option>
                <option>Aadhaar</option><option>Passport</option><option>Driving licence</option><option>Voter ID</option>
              </select>
            </div>
            <FileUpload id="owner_id" name="owner_id_path" label="Owner ID file" bucket="seller-documents" userId={user.id} folder="owner-id"
              accept="image/jpeg,image/png,application/pdf" maxMb={4} required hint="JPG, PNG or PDF, up to 4 MB." />
            <div className="field"><label htmlFor="travel_registration_number">Travel registration number</label><input id="travel_registration_number" name="travel_registration_number" /><span className="field__hint">Optional. Having one earns a Verified Partner badge.</span></div>
            <FileUpload id="travel_registration" name="travel_registration_path" label="Travel registration file" bucket="seller-documents" userId={user.id} folder="travel-registration"
              accept="image/jpeg,image/png,application/pdf" maxMb={4} />
          </div>
        </fieldset>

        <div className="actions">
          <button className="btn btn--primary" type="submit">Send application</button>
        </div>
        <p className="muted small">Your documents are stored privately. Only ZoomFly&rsquo;s review team can open them.</p>
      </form>
    </div>
  )
}
