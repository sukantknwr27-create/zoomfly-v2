import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { STATUS_LABEL, missingFields, statusPill } from '@/lib/packages'
import { formatDate, formatPaise } from '@/lib/format'
import { FileUpload } from '@/components/FileUpload'
import type { DepartureRow, PackageRow } from '@/lib/types'
import { addDeparture, addPhotos, cancelDeparture, deleteDraft, removeDeparture, removePhoto, savePackage, setPackageState } from '../actions'

export const metadata: Metadata = { title: 'Edit trip' }
export const dynamic = 'force-dynamic'

export default async function EditPackage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const user = await requireUser(`/seller/packages/${params.id}`)
  const supabase = createClient()
  const { data } = await supabase.from('packages').select('*').eq('id', params.id).maybeSingle()
  const p = data as PackageRow | null
  if (!p) notFound()

  const [{ data: deps }, { data: dests }, { data: codes }, { data: tiers }, { data: rates }] = await Promise.all([
    supabase.from('package_departures').select('*').eq('package_id', p.id).order('departure_date'),
    supabase.from('destinations').select('id, name, state').eq('is_active', true).order('name'),
    supabase.from('cancellation_policy_codes').select('code, label, summary'),
    supabase.from('cancellation_policy_tiers').select('code, min_days_before, refund_pct').order('min_days_before', { ascending: false }),
    supabase.from('commission_rates').select('category, label, rate_pct').eq('is_active', true).order('rate_pct'),
  ])
  const departures = (deps ?? []) as DepartureRow[]
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const missing = missingFields(p, departures, today)
  const editableForSubmit = p.listing_status === 'draft' || p.listing_status === 'changes_requested'
  const days = Math.min(Math.max(p.itinerary?.length ?? 0, p.duration_days ?? 0, 1), 60)
  const it = p.itinerary ?? []

  return (
    <div className="wrap page">
      <p className="small"><Link href="/seller/packages">Your trips</Link></p>
      <div className="page__head">
        <h1>{p.title}</h1>
        <div className="status-line">
          <span className={statusPill(p.listing_status)}>{STATUS_LABEL[p.listing_status]}</span>
          {p.listing_status === 'published' && <Link href={`/trips/${p.slug}`}>See it as travellers do</Link>}
        </div>
      </div>

      {searchParams.error && <p className="notice notice--error" role="alert">{searchParams.error}</p>}
      {searchParams.ok && <p className="notice notice--ok" role="status">{searchParams.ok}</p>}
      {p.listing_status === 'changes_requested' && <p className="notice notice--wait"><strong>Changes needed.</strong> {p.review_note}</p>}
      {p.listing_status === 'rejected' && (
        <div className="notice notice--error">
          <strong>This trip was not accepted.</strong> {p.review_note}
          <form action={setPackageState} style={{ marginTop: 10 }}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="to" value="reopen" /><button className="btn" type="submit">Reopen as a draft</button></form>
        </div>
      )}
      {p.listing_status === 'submitted' && <p className="notice notice--wait">We are reviewing this trip. You can still make changes while you wait.</p>}
      {editableForSubmit && missing.length > 0 && (
        <div className="notice notice--wait">
          <strong>Before you can send this for review, add:</strong>
          <ul className="plain-list" style={{ margin: '8px 0 0' }}>{missing.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}

      <form className="form form--wide" action={savePackage}>
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="day_count" value={days} />

        <fieldset className="fieldset">
          <legend>The basics</legend>
          <div className="field"><label htmlFor="title">Trip title</label><input id="title" name="title" defaultValue={p.title} minLength={5} maxLength={90} required /></div>
          <div className="field"><label htmlFor="description">About this trip</label><textarea id="description" name="description" rows={4} defaultValue={p.description ?? ''} /><span className="field__hint">Two or three honest sentences. Say what travellers will actually do.</span></div>
          <div className="form__grid">
            <div className="field">
              <label htmlFor="destination_id">Main destination</label>
              <select id="destination_id" name="destination_id" defaultValue={p.destination_id ?? ''}>
                <option value="">Choose one</option>
                {(dests ?? []).map((d: { id: string; name: string; state: string | null }) => <option key={d.id} value={d.id}>{d.name}{d.state ? `, ${d.state}` : ''}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="departure_city">Leaves from</label><input id="departure_city" name="departure_city" defaultValue={p.departure_city ?? ''} placeholder="Delhi" /></div>
            <div className="field"><label htmlFor="pickup_point">Pickup point</label><input id="pickup_point" name="pickup_point" defaultValue={p.pickup_point ?? ''} placeholder="Kashmere Gate ISBT, 6 pm" /></div>
            <div className="field"><label htmlFor="drop_point">Drop point</label><input id="drop_point" name="drop_point" defaultValue={p.drop_point ?? ''} /></div>
            <div className="field"><label htmlFor="duration_days">Days</label><input id="duration_days" name="duration_days" type="number" min={1} max={60} defaultValue={p.duration_days ?? ''} /></div>
            <div className="field"><label htmlFor="nights">Nights</label><input id="nights" name="nights" type="number" min={0} max={60} defaultValue={p.nights ?? ''} /></div>
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Price</legend>
          <div className="form__grid">
            <div className="field"><label htmlFor="price">Price per person, in rupees</label><input id="price" name="price" inputMode="decimal" defaultValue={p.price_paise ? String(p.price_paise / 100) : ''} placeholder="15000" /><span className="field__hint">This is the all-in price travellers see. Include every tax and fee you charge.</span></div>
            <div className="field"><label htmlFor="occupancy_basis">The price is based on</label><input id="occupancy_basis" name="occupancy_basis" defaultValue={p.occupancy_basis ?? ''} placeholder="per person, twin sharing" /></div>
          </div>
          <label className="check"><input type="checkbox" name="price_includes_taxes" defaultChecked={p.price_includes_taxes} /><span>The price includes all taxes</span></label>
          <p className="muted small" style={{ margin: 0 }}>
            ZoomFly sets the commission category when it approves a trip: {(rates ?? []).map((r: { label: string; rate_pct: number }) => `${r.label} ${Number(r.rate_pct)}%`).join(', ')}.
          </p>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Day by day</legend>
          {Array.from({ length: days }, (_, i) => (
            <div key={i} className="form__grid">
              <div className="field"><label htmlFor={`day_title_${i + 1}`}>Day {i + 1}: title</label><input id={`day_title_${i + 1}`} name={`day_title_${i + 1}`} defaultValue={it[i]?.title ?? ''} /></div>
              <div className="field"><label htmlFor={`day_desc_${i + 1}`}>Day {i + 1}: what happens</label><textarea id={`day_desc_${i + 1}`} name={`day_desc_${i + 1}`} rows={2} defaultValue={it[i]?.description ?? ''} /></div>
            </div>
          ))}
          <span className="field__hint">The number of rows follows the number of days above. Change the days, save, and the rows update.</span>
        </fieldset>

        <fieldset className="fieldset">
          <legend>What is and is not included</legend>
          <div className="form__grid">
            <div className="field"><label htmlFor="inclusions">Included, one per line</label><textarea id="inclusions" name="inclusions" rows={6} defaultValue={(p.inclusions ?? []).join('\n')} placeholder={'4 nights in a 3-star hotel\nBreakfast and dinner\nTempo Traveller for all transfers'} /></div>
            <div className="field"><label htmlFor="exclusions">Not included, one per line</label><textarea id="exclusions" name="exclusions" rows={6} defaultValue={(p.exclusions ?? []).join('\n')} placeholder={'Train or flight tickets\nLunch\nPersonal expenses'} /></div>
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Stay, food and travel</legend>
          <div className="form__grid">
            <div className="field"><label htmlFor="hotel_details">Stay</label><input id="hotel_details" name="hotel_details" defaultValue={p.hotel_details ?? ''} placeholder="3-star hotel near Mall Road, 2 per room" /></div>
            <div className="field"><label htmlFor="meal_plan">Meals</label><input id="meal_plan" name="meal_plan" defaultValue={p.meal_plan ?? ''} placeholder="Breakfast and dinner" /></div>
            <div className="field"><label htmlFor="vehicle_type">Transport</label><input id="vehicle_type" name="vehicle_type" defaultValue={p.vehicle_type ?? ''} placeholder="Tempo Traveller" /></div>
            <div className="field"><label htmlFor="child_policy">Children</label><input id="child_policy" name="child_policy" defaultValue={p.child_policy ?? ''} placeholder="Under 5 free without a seat" /></div>
            <div className="field"><label htmlFor="min_group">Smallest group</label><input id="min_group" name="min_group" type="number" min={1} defaultValue={p.min_group ?? ''} /></div>
            <div className="field"><label htmlFor="max_group">Largest group</label><input id="max_group" name="max_group" type="number" min={1} defaultValue={p.max_group ?? ''} /></div>
            <div className="field">
              <label htmlFor="difficulty_level">How demanding is it?</label>
              <select id="difficulty_level" name="difficulty_level" defaultValue={p.difficulty_level ?? ''}><option value="">Not applicable</option><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="hard">Hard</option></select>
            </div>
          </div>
          <label className="check"><input type="checkbox" name="high_risk_activities" defaultChecked={p.high_risk_activities} /><span>This trip includes high-risk activities, such as rafting, paragliding, scuba or high-altitude trekking</span></label>
          <label className="check"><input type="checkbox" name="insurance_provided" defaultChecked={p.insurance_provided} /><span>Insurance for travellers is included. It is required if the trip has high-risk activities.</span></label>
          <div className="field"><label htmlFor="insurance_details">Insurance details</label><input id="insurance_details" name="insurance_details" defaultValue={p.insurance_details ?? ''} placeholder="Insurer and what it covers" /></div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>If a traveller cancels</legend>
          {(codes ?? []).map((c: { code: string; label: string; summary: string }) => (
            <label key={c.code} className="check">
              <input type="radio" name="cancellation_policy" value={c.code} defaultChecked={p.cancellation_policy === c.code} />
              <span>
                <strong>{c.label}.</strong> {c.summary}
                <span className="muted small" style={{ display: 'block' }}>
                  {(tiers ?? []).filter((t: { code: string }) => t.code === c.code).map((t: { min_days_before: number; refund_pct: number }) => `${t.min_days_before > 0 ? `${t.min_days_before}+ days before` : 'closer to departure'}: ${t.refund_pct}%`).join('; ')}
                </span>
              </span>
            </label>
          ))}
          <span className="field__hint">If you cancel a departure, travellers always get a full refund.</span>
        </fieldset>

        <div className="actions">
          <button className="btn" type="submit" name="intent" value="save">Save</button>
          {editableForSubmit && <button className="btn btn--primary" type="submit" name="intent" value="submit">Save and send for review</button>}
        </div>
      </form>

      <section className="section" id="photos">
        <h2>Photos</h2>
        <p className="muted">Use real photos of this trip&rsquo;s hotels, routes and activities. At least 3 are needed. We do not accept stock images.</p>
        {p.photos.length > 0 && (
          <ul className="chips" style={{ gap: 14, marginBottom: 20 }}>
            {p.photos.map((u) => (
              <li key={u} style={{ width: 180 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" style={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 6 }} />
                <form action={removePhoto} style={{ marginTop: 6 }}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="url" value={u} /><button className="btn" type="submit" style={{ padding: '4px 12px', fontSize: '0.9rem' }}>Remove</button></form>
              </li>
            ))}
          </ul>
        )}
        <form className="form" action={addPhotos}>
          <input type="hidden" name="id" value={p.id} />
          <FileUpload id="photos_input" name="photo_path" label="Add photos" bucket="package-photos" userId={user.id} folder={p.id} accept="image/jpeg,image/png,image/webp" maxMb={5} multiple hint="JPG, PNG or WebP, up to 5 MB each. Select several at once." />
          <div className="actions"><button className="btn" type="submit">Add the uploaded photos</button></div>
        </form>
      </section>

      <section className="section" id="departures">
        <h2>Departures and seats</h2>
        <p className="muted">Travellers can book only the dates and seats you list here. Seats are counted as people book.</p>
        {departures.length > 0 && (
          <table className="table" style={{ marginBottom: 24 }}>
            <thead><tr><th>Departs</th><th>Seats sold</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {departures.map((d) => (
                <tr key={d.id}>
                  <td>{formatDate(d.departure_date, true)}{d.return_date ? <span className="muted small"><br />back {formatDate(d.return_date)}</span> : null}</td>
                  <td>{d.booked_seats} of {d.total_seats}</td>
                  <td>{d.price_override_paise ? formatPaise(d.price_override_paise) : <span className="muted">Trip price</span>}</td>
                  <td>{d.status === 'open' ? (d.departure_date < today ? 'Past' : 'Open') : d.status === 'cancelled' ? 'Cancelled' : 'Closed'}</td>
                  <td>
                    {d.status === 'open' && d.booked_seats === 0 && (
                      <form action={removeDeparture}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="departure_id" value={d.id} /><button className="btn" type="submit" style={{ padding: '4px 12px', fontSize: '0.9rem' }}>Remove</button></form>
                    )}
                    {d.status === 'open' && d.booked_seats > 0 && (
                      <form action={cancelDeparture} className="form" style={{ gap: 6 }}>
                        <input type="hidden" name="id" value={p.id} /><input type="hidden" name="departure_id" value={d.id} />
                        <input name="reason" placeholder="Reason for travellers" aria-label="Reason for cancelling" required style={{ font: 'inherit', padding: '6px 8px', border: '1.5px solid var(--line)', borderRadius: 6 }} />
                        <button className="btn btn--danger" type="submit" style={{ padding: '4px 12px', fontSize: '0.9rem' }}>Cancel and refund {d.booked_seats} seat{d.booked_seats === 1 ? '' : 's'}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form className="form form--wide" action={addDeparture}>
          <input type="hidden" name="id" value={p.id} />
          <div className="form__grid">
            <div className="field"><label htmlFor="departure_date">Departure date</label><input id="departure_date" name="departure_date" type="date" min={today} required /></div>
            <div className="field"><label htmlFor="return_date">Return date</label><input id="return_date" name="return_date" type="date" min={today} /><span className="field__hint">Optional. We work it out from the trip length if you leave it empty.</span></div>
            <div className="field"><label htmlFor="total_seats">Seats you are selling</label><input id="total_seats" name="total_seats" type="number" min={1} max={500} required /></div>
            <div className="field"><label htmlFor="booking_cutoff_days">Bookings close, days before departure</label><input id="booking_cutoff_days" name="booking_cutoff_days" type="number" min={0} max={30} defaultValue={2} /></div>
            <div className="field"><label htmlFor="price_override">Special price for this date, in rupees</label><input id="price_override" name="price_override" inputMode="decimal" /><span className="field__hint">Optional, for example a peak-season date.</span></div>
          </div>
          <div className="actions"><button className="btn" type="submit">Add departure</button></div>
        </form>
      </section>

      <section className="section">
        <h2>Manage this trip</h2>
        <div className="actions">
          {p.listing_status === 'published' && <form action={setPackageState}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="to" value="pause" /><button className="btn" type="submit">Pause bookings</button></form>}
          {p.listing_status === 'paused' && <form action={setPackageState}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="to" value="resume" /><button className="btn btn--primary" type="submit">Make it live again</button></form>}
          {p.listing_status === 'draft' && <form action={deleteDraft}><input type="hidden" name="id" value={p.id} /><button className="btn btn--danger" type="submit">Delete this draft</button></form>}
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>Changing the plan, inclusions, cancellation policy, stay, meals or transport of a live trip sends it back to review and hides it until we approve it. Changing the price does not.</p>
      </section>
    </div>
  )
}
