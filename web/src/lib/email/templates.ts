import { formatDate, formatPaise } from '@/lib/format'

type P = Record<string, unknown>
export type Rendered = { subject: string; html: string; text: string }
type Spec = { subject: string; paragraphs: string[]; cta?: { label: string; path: string } }

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const s = (v: unknown) => String(v ?? '')
const money = (v: unknown) => formatPaise(Number(v ?? 0))
const day = (v: unknown) => formatDate(typeof v === 'string' ? v.slice(0, 10) : '', true)
const first = (v: unknown) => s(v).split(' ')[0] || 'there'

// One spec per email: a subject, a few plain paragraphs and an optional button. Everything dynamic is escaped when the HTML
// is built, so a seller-written trip title can never inject markup into an email.
const SPECS: Record<string, (p: P) => Spec> = {
  booking_confirmed: (p) => ({
    subject: `Your seats are booked: ${s(p.title)}`,
    paragraphs: [`Hi ${first(p.first_name)}, your ${p.seats} ${Number(p.seats) === 1 ? 'seat is' : 'seats are'} booked on ${s(p.title)}, leaving ${day(p.departure_date)}.`, `You have paid ${money(p.paid_paise)}. The balance of ${money(Number(p.total_paise) - Number(p.paid_paise))} is due ${p.balance_due_on ? `by ${day(p.balance_due_on)}` : 'before departure'}. We will remind you.`, `Booking reference ${s(p.ref)}.`],
    cta: { label: 'See your booking', path: `/bookings/${s(p.booking_id)}` },
  }),
  booking_paid_in_full: (p) => ({
    subject: `Paid in full: ${s(p.title)}`,
    paragraphs: [`Hi ${first(p.first_name)}, your trip ${s(p.title)} is paid in full. It leaves ${day(p.departure_date)}.`, `Your seller's contact details are now on your booking page, so you can arrange pickup and last details directly.`, `Booking reference ${s(p.ref)}.`],
    cta: { label: 'Open your booking', path: `/bookings/${s(p.booking_id)}` },
  }),
  balance_reminder: (p) => ({
    subject: p.urgent ? `Balance due now: ${s(p.title)}` : `Balance due ${day(p.balance_due_on)}: ${s(p.title)}`,
    paragraphs: [`Hi ${first(p.first_name)}, the balance for ${s(p.title)} is ${money(Number(p.total_paise) - Number(p.paid_paise))}, due ${day(p.balance_due_on)}.`, `Paying on time keeps your seats. You can pay from your booking page in a minute.`],
    cta: { label: 'Pay the balance', path: `/bookings/${s(p.booking_id)}` },
  }),
  balance_overdue: (p) => ({
    subject: `Your balance is overdue: ${s(p.title)}`,
    paragraphs: [`Hi ${first(p.first_name)}, the balance of ${money(Number(p.total_paise) - Number(p.paid_paise))} for ${s(p.title)} was due ${day(p.balance_due_on)} and we have not received it.`, `Please pay it as soon as you can, or reply to this email if there is a problem. Your seats may be released if the balance stays unpaid.`],
    cta: { label: 'Pay the balance', path: `/bookings/${s(p.booking_id)}` },
  }),
  trip_reminder: (p) => ({
    subject: `Your trip leaves in 3 days: ${s(p.title)}`,
    paragraphs: [`Hi ${first(p.first_name)}, ${s(p.title)} leaves on ${day(p.departure_date)}.`, `Your seller's contact details and your booking are on your booking page. Have a good trip.`],
    cta: { label: 'Open your booking', path: `/bookings/${s(p.booking_id)}` },
  }),
  booking_cancelled: (p) => ({
    subject: `Booking cancelled: ${s(p.title)}`,
    paragraphs: [
      s(p.by) === 'customer' ? `Hi ${first(p.first_name)}, your booking ${s(p.ref)} for ${s(p.title)} is cancelled.` : `Hi ${first(p.first_name)}, we are sorry: your booking ${s(p.ref)} for ${s(p.title)} was cancelled${s(p.by) === 'seller' ? ' by the seller' : ' by ZoomFly'}.${p.reason ? ` Reason: ${s(p.reason)}` : ''}`,
      Number(p.refund_paise) > 0 ? `A refund of ${money(p.refund_paise)} is on its way to your original payment method. It usually takes 5 to 7 working days to show up.` : `Under this trip's cancellation policy, no refund is due.`,
    ],
    cta: { label: 'See the details', path: `/bookings/${s(p.booking_id)}` },
  }),
  refund_sent: (p) => ({
    subject: `Your refund of ${money(p.refund_paise)} is on its way`,
    paragraphs: [`We have sent ${money(p.refund_paise)} back to your original payment method for booking ${s(p.ref)} (${s(p.title)}).`, `Banks usually take 5 to 7 working days to show it.`],
    cta: { label: 'See your booking', path: `/bookings/${s(p.booking_id)}` },
  }),
  review_request: (p) => ({
    subject: `How was ${s(p.title)}?`,
    paragraphs: [`Hi ${first(p.first_name)}, we hope ${s(p.title)} went well.`, `A short review helps other travellers, and tells us whether the trip matched its listing.`],
    cta: { label: 'Write your review', path: `/bookings/${s(p.booking_id)}` },
  }),
  seller_new_booking: (p) => ({
    subject: `New booking: ${s(p.title)}, ${day(p.departure_date)}`,
    paragraphs: [`${first(p.first_name)} has booked ${p.seats} ${Number(p.seats) === 1 ? 'seat' : 'seats'} on ${s(p.title)} for ${day(p.departure_date)}.`, `The advance is paid. Traveller names are on your bookings page now. The customer's phone and email are shared once they have paid in full.`],
    cta: { label: 'Open your bookings', path: '/seller/bookings' },
  }),
  seller_booking_paid: (p) => ({
    subject: `Booking paid in full: ${s(p.title)}, ${day(p.departure_date)}`,
    paragraphs: [`Booking ${s(p.ref)} for ${s(p.title)} (${p.seats} ${Number(p.seats) === 1 ? 'seat' : 'seats'}, ${day(p.departure_date)}) is paid in full.`, `The customer's contact details are on your bookings page. Your payouts are scheduled as the trip approaches and after it ends.`],
    cta: { label: 'Open your bookings', path: '/seller/bookings' },
  }),
  seller_booking_cancelled: (p) => ({
    subject: `Booking cancelled: ${s(p.title)}, ${day(p.departure_date)}`,
    paragraphs: [`Booking ${s(p.ref)} for ${s(p.title)} on ${day(p.departure_date)} was cancelled${s(p.by) === 'customer' ? ' by the traveller' : s(p.by) === 'seller' ? ' by you' : ' by ZoomFly'}.`, `The seats are open again. If you cancel departures that have bookings, travellers are refunded in full and it counts against your seller record.`],
    cta: { label: 'Open your bookings', path: '/seller/bookings' },
  }),
  seller_application_received: (p) => ({
    subject: 'We have your seller application',
    paragraphs: [`Hi ${first(p.name)}, thank you for applying to sell on ZoomFly with ${s(p.business)}.`, `We are checking your documents and aim to finish within 2 working days. We will email you the moment there is news.`],
    cta: { label: 'See your application', path: '/seller' },
  }),
  seller_approved: (p) => ({
    subject: `Welcome to ZoomFly, ${s(p.business)}`,
    paragraphs: [`Hi ${first(p.name)}, your seller account is approved and your documents are verified.`, `You can now add trips. Each trip is reviewed by our team before it goes live. Add at least 3 real photos and a departure date with seats.`],
    cta: { label: 'Add your first trip', path: '/seller/packages/new' },
  }),
  seller_rejected: (p) => ({
    subject: 'About your ZoomFly seller application',
    paragraphs: [`Hi ${first(p.name)}, we could not approve your application for ${s(p.business)}.`, p.note ? `Reason: ${s(p.note)}` : `Please reply to this email and we will explain.`, `If you can fix this, reply to this email and we will look again.`],
  }),
  seller_suspended: (p) => ({
    subject: 'Your ZoomFly seller account is suspended',
    paragraphs: [`Hi ${first(p.name)}, your seller account for ${s(p.business)} is suspended, and your trips are hidden while it is.`, p.note ? `Reason: ${s(p.note)}` : ``, `Reply to this email to talk to us about reinstating it.`].filter(Boolean),
  }),
  seller_banned: (p) => ({
    subject: 'Your ZoomFly seller account has been closed',
    paragraphs: [`Hi ${first(p.name)}, your seller account for ${s(p.business)} has been closed and your trips are removed.`, p.note ? `Reason: ${s(p.note)}` : ``, `Bookings already made will be handled by our team so travellers are looked after.`].filter(Boolean),
  }),
  trip_published: (p) => ({
    subject: `Your trip is live: ${s(p.title)}`,
    paragraphs: [`${s(p.title)} was approved and travellers can now find and book it.`],
    cta: { label: 'See it as travellers do', path: `/trips/${s(p.slug)}` },
  }),
  trip_changes_requested: (p) => ({
    subject: `Changes needed on ${s(p.title)}`,
    paragraphs: [`We reviewed ${s(p.title)} and need a few changes before it can go live:`, s(p.note), `Make the changes and send it for review again.`],
    cta: { label: 'Edit the trip', path: `/seller/packages/${s(p.package_id)}` },
  }),
  trip_rejected: (p) => ({
    subject: `${s(p.title)} was not accepted`,
    paragraphs: [`We could not accept ${s(p.title)}.`, s(p.note), `You can reopen it as a draft, fix what we mentioned and send it again.`],
    cta: { label: 'Open the trip', path: `/seller/packages/${s(p.package_id)}` },
  }),
  new_message: (p) => ({
    subject: `New message about ${s(p.title)}`,
    paragraphs: [`${s(p.from)} wrote to you about ${s(p.title)}:`, `“${s(p.snippet)}”`, `Reply on ZoomFly so everything stays in one place. Phone numbers and emails are kept private until a trip is paid in full.`],
    cta: { label: 'Read and reply', path: `/messages/${s(p.conversation_id)}` },
  }),
  dispute_opened_seller: (p) => ({
    subject: `A traveller reported a problem: ${s(p.title)}`,
    paragraphs: [`A traveller has reported a problem with booking ${s(p.ref)} (${s(p.title)}):`, `“${s(p.reason)}”`, `Our team is looking into it and will contact you. Your payouts for this booking are paused until it is settled.`],
    cta: { label: 'Open your bookings', path: '/seller/bookings' },
  }),
  dispute_opened_customer: (p) => ({
    subject: `We received your report: ${s(p.title)}`,
    paragraphs: [`We have your report about booking ${s(p.ref)}. Our team will reply within 2 days and aims to settle it within 7.`],
    cta: { label: 'See your booking', path: `/bookings/${s(p.booking_id)}` },
  }),
  dispute_resolved: (p) => ({
    subject: `Dispute settled: ${s(p.title)}`,
    paragraphs: [`The report about booking ${s(p.ref)} (${s(p.title)}) has been settled.`, `Our decision: ${s(p.note)}`, Number(p.refund_paise) > 0 ? `A refund of ${money(p.refund_paise)} has been arranged for the traveller.` : `No refund was awarded.`],
  }),
  payout_paid: (p) => ({
    subject: `Payout sent: ${money(p.amount_paise)}`,
    paragraphs: [`We have transferred ${money(p.amount_paise)} to your bank account for booking ${s(p.ref)}.`, `Bank reference (UTR): ${s(p.utr)}.`],
    cta: { label: 'See your payouts', path: '/seller/bookings' },
  }),
  admin_new_seller: (p) => ({ subject: `New seller application: ${s(p.business)}`, paragraphs: [`${s(p.business)}${p.city ? `, ${s(p.city)}` : ''} has applied to sell on ZoomFly.`], cta: { label: 'Review it', path: `/admin/sellers/${s(p.seller_id)}` } }),
  admin_trip_submitted: (p) => ({ subject: `Trip waiting for review: ${s(p.title)}`, paragraphs: [`${s(p.seller)} sent ${s(p.title)} for review.`], cta: { label: 'Review it', path: `/admin/packages/${s(p.package_id)}` } }),
  admin_dispute_opened: (p) => ({ subject: `New dispute: ${s(p.title)}`, paragraphs: [`A ${s(p.by)} reported a problem on booking ${s(p.ref)}:`, `“${s(p.reason)}”`, `First reply is due within 48 hours.`], cta: { label: 'Open disputes', path: '/admin/disputes' } }),
  admin_balance_overdue: (p) => ({ subject: `Balance overdue: ${s(p.ref)}`, paragraphs: [`Booking ${s(p.ref)} (${s(p.title)}) has an unpaid balance of ${money(Number(p.total_paise) - Number(p.paid_paise))} that was due ${day(p.balance_due_on)}. Decide whether to chase it or release the seats.`] }),
}

export const KNOWN_TEMPLATES = Object.keys(SPECS)

export function renderEmail(template: string, payload: P, siteUrl: string): Rendered | null {
  const make = SPECS[template]
  if (!make) return null
  const spec = make(payload)
  const url = spec.cta ? siteUrl.replace(/\/$/, '') + spec.cta.path : ''
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#eef2f6;font-family:Arial,Helvetica,sans-serif;color:#12263a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d3dbe4;border-radius:10px;overflow:hidden">
<tr><td style="background:#12263a;padding:18px 24px"><span style="font-size:22px;font-weight:800;color:#ffffff">ZoomFly</span><span style="font-size:22px;font-weight:800;color:#f2a100">.</span></td></tr>
<tr><td style="padding:26px 24px 8px;font-size:16px;line-height:1.55">
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.25;color:#12263a">${esc(spec.subject)}</h1>
${spec.paragraphs.map((x) => `<p style="margin:0 0 14px">${esc(x)}</p>`).join('\n')}
${spec.cta ? `<p style="margin:22px 0 14px"><a href="${esc(url)}" style="display:inline-block;background:#f2a100;color:#12263a;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:6px">${esc(spec.cta.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;line-height:1.5;color:#46586b;border-top:1px solid #d3dbe4">You are getting this because of activity on your ZoomFly account. Questions? Just reply to this email.</td></tr>
</table></td></tr></table></body></html>`
  const text = [spec.subject, '', ...spec.paragraphs, ...(spec.cta ? ['', `${spec.cta.label}: ${url}`] : []), '', '--', 'ZoomFly. You are getting this because of activity on your ZoomFly account. Questions? Just reply to this email.'].join('\n')
  return { subject: spec.subject, html, text }
}
