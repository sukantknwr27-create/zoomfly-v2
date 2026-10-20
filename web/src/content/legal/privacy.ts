const body = `# Privacy Policy

*Last updated: [DATE]. This explains what personal information ZoomFly collects, why, and who sees it.*

## 1. Who is responsible

[COMPANY LEGAL NAME], [REGISTERED ADDRESS] ("ZoomFly") decides how your information is used. [LAWYER: confirm ZoomFly's role under the Digital Personal Data Protection Act, 2023 and any other applicable law.]

## 2. What we collect

- **Your account:** name, email address, phone number, password (stored securely, never in readable form).
- **Your bookings:** traveller names and ages, the contact person's name, phone and email, the trips and dates you book.
- **Payments:** Razorpay processes your payment. We receive the payment reference, amount and status. We never receive your full card number or bank login.
- **Messages:** what you write to a Seller through ZoomFly chat. The other person sees a version with phone numbers, emails and links hidden. We keep the original so we can investigate misuse.
- **Reviews and reports:** what you write in reviews and problem reports.
- **If you sell on ZoomFly:** your business and bank details, GSTIN, PAN, a cancelled cheque, an ID of the owner, and travel registration if you have one.
- **Technical data:** a sign-in cookie, and basic server logs needed to run and protect the site.

## 3. Why we use it

- To run your booking: confirm seats, take payments, pay the Seller, send you confirmations and reminders.
- To keep the marketplace safe: verify Sellers, prevent fraud, review reports, and enforce our rules.
- To help you: answer questions and settle disputes.
- To meet legal and tax duties.

We send emails about your own bookings and account activity. We do not send advertising.

## 4. Who sees what

- **The Seller** sees traveller names once your advance is paid, and your phone and email once your trip is paid in full.
- **ZoomFly's team** sees what it needs to run the service and handle reports.
- **Service providers** that process data for us: Supabase (database, sign-in and file storage), Vercel (hosting), Razorpay (payments) and Resend (email). [LAWYER: confirm cross-border transfer wording and processor agreements.]
- **Authorities**, when the law requires it.

We do not sell your information.

## 5. Cookies

We use only the cookies needed to keep you signed in. We do not use advertising cookies. [Update this section if analytics are added.]

## 6. How long we keep it

[LAWYER: set retention periods for bookings, tax records, messages, seller documents and closed accounts.]

## 7. Your rights

You can ask to see, correct or delete your information, or to withdraw consent, subject to what we must keep by law. [LAWYER: complete the list of rights and the response time.]

## 8. Security

Seller documents are kept in private storage that only the owner and ZoomFly's reviewers can open. Access to data is restricted by role, and traffic is encrypted. No system is perfectly secure, so please use a strong password.

## 9. Children

ZoomFly is for adults. Travellers under 18 can be included in a booking made by an adult.

## 10. Grievance officer and changes

Grievance officer: [NAME], [EMAIL], [ADDRESS]. We may update this policy and will change the date above when we do.
`
export default body
