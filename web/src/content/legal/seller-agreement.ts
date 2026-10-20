const body = `# Seller Agreement

*Last updated: [DATE]. This agreement is between [COMPANY LEGAL NAME] ("ZoomFly") and the business that applies to sell on ZoomFly ("you").*

## 1. The relationship

You are an independent tour operator. You, not ZoomFly, provide the trips you list. ZoomFly provides the marketplace, takes payments from travellers, and pays you as set out below. Nothing here makes you ZoomFly's employee, partner or agent. [LAWYER: confirm the intermediary structure and who issues invoices to travellers.]

## 2. Who can sell

You must have a valid GSTIN and the other documents we ask for: PAN, a bank account with a cancelled cheque, your business address, and an ID of the owner. A travel registration is optional, and earns a Verified Partner badge. We verify these before your first trip can go live. You must keep them accurate and up to date.

## 3. Your listings

- Everything you list must be true: itinerary, inclusions, exclusions, hotels, transport, group sizes and photos.
- The price must be the all-in price per person, with taxes included or clearly stated as extra.
- Departure dates and seat counts must be real. Seats are sold as travellers book.
- Use real photos of the trip. At least 3 are required.
- Trips with high-risk activities must include insurance.
- You may not list foreign education packages, medical tourism, or high-risk activities without insurance. See the [Marketplace rules](/marketplace-rules).
- If you change the plan, inclusions, stay, meals, transport or cancellation policy of a live trip, it goes back to review and is hidden until approved. A price change takes effect at once and does not affect bookings already made.

## 4. Commission

ZoomFly charges a commission on each booking. ZoomFly decides which category a trip belongs to, and the rate is fixed on the trip when it is approved. Current rates:

{{COMMISSION_RATES}}

Commission is taken from what the traveller pays. [CA: GST on commission and who raises the invoice.]

## 5. How you are paid

Travellers pay ZoomFly. After deducting commission, we pay you in stages:

{{PAYOUT_SCHEDULE}}

We pay a stage only when the traveller's money for it has been received. We hold your payouts for a booking while a dispute about it is open. If a refund has to be paid to a traveller, the amount is deducted from what you are owed, and from future payouts if needed. You are responsible for GST on the packages you sell and for your own invoices. [CA: confirm the tax treatment, including any tax collected at source by ZoomFly.]

## 6. If you cancel

If you cancel a departure that has bookings, every traveller is refunded in full. Cancellations count against your record and affect how your trips rank. Repeated cancellations lead to the consequences in section 8.

## 7. Keeping travellers on ZoomFly

Travellers must not be taken off ZoomFly. You may not share phone numbers, emails, links or payment details in chat, or ask a traveller to pay you directly. Chat is monitored. Your contact details reach a traveller only when their trip is paid in full, and theirs reach you at the same time. You may use traveller details only to deliver that trip.

## 8. Standards and consequences

You must deliver trips as listed and respond to travellers promptly. We handle reports within 7 days, and our decision may include a refund paid from your payouts.

- First strike: a warning.
- Second strike: suspension. Your trips are hidden.
- Third strike: removal from ZoomFly.
- Fake listings, fake reviews and fraud lead to immediate removal.

## 9. Reviews

Only travellers who completed a trip can review it. You may not write, buy or ask for fake reviews.

## 10. Ending this agreement

You may stop selling at any time, after honouring existing bookings. We may suspend or end your account for breaking this agreement or the Marketplace rules. [LAWYER: notice periods and what happens to open bookings and payouts.]

## 11. Liability and law

[LAWYER: liability, indemnity, confidentiality, data protection, and dispute resolution.] This agreement is governed by Indian law. [LAWYER: choose courts or arbitration.]
`
export default body
