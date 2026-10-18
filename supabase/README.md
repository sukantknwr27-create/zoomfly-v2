# ZoomFly v2: database (marketplace-native)

Run the five files in `migrations/` **in order** in a NEW Supabase project (SQL editor, or `supabase db push`).
Money is stored in paise. Nothing here depends on the old ZoomFly schema.

| File | What it builds |
|---|---|
| `…01_core_identity` | profiles, sellers, verification checklist (admin-only flags), private document bucket, public photo bucket, `public_sellers` view |
| `…02_catalog` | destinations, commission rates (5/7/10/4/12), cancellation policies (data), packages with the draft→submitted→published workflow, departures with real seat counts, public views |
| `…03_bookings_money` | bookings, payments, refunds, seller payouts (30/50/20), clawbacks, settings, and the server-only money functions |
| `…04_trust` | masked chat (phones, emails and links never reach the other side), reviews (completed trips only), strikes ladder, disputes (48h / 7d, payouts frozen), contact reveal |
| `…05_grants` | permission allowlist: anon sees only curated views; browsers can never touch money tables |

## Server-only functions (call with the service-role key from Next.js route handlers / cron, never from the browser)
`create_booking`, `record_payment` (Razorpay webhook), `expire_unpaid_bookings` (every ~5 min), `complete_due_bookings` (daily),
`release_due_payouts` (daily), `cancel_booking`. Admin/seller callable (checked inside): `cancel_departure_by_seller`, `issue_strike`, `mark_payout_paid`, `get_booking_contacts`, `start_conversation`.

## Rules baked into the database
- Prices always come from the DB (`create_booking`); the client sends only the departure and traveller counts.
- Seats are locked per departure (`FOR UPDATE`): no overselling; unpaid holds expire (30 min) and a lapsed hold is freed the moment someone else tries to book those seats.
- A seller cannot publish, set commission, change ratings, or alter verified identity/bank data.
- Editing itinerary/inclusions/cancellation on a live package sends it back to review; a price change stays live.
- A payout is never released before ZoomFly has collected the money (net of commission); disputes freeze payouts.
- Seller contact is shown to the customer only when fully paid; the customer's phone to the seller only when fully paid.

## PLACEHOLDERS you must confirm (all editable data, no code change)
- `cancellation_policy_tiers`: flexible 90% (7+ days) / 50% (3–6) / 0%; moderate 50% (15+ days) / 0%; strict 0%.
- `marketplace_settings`: advance 20%, balance due 21 days before departure, hold 30 min, payout m1 30% at 14 days before, m2 50% at 7 days before, m3 20% 48 h after the trip.
- Final GST treatment, TCS and the customer-invoice model (CA), and whether the platform may hold funds or must settle through the gateway (RBI payment rules).

## Tested
PostgreSQL 16 with Supabase-style roles and auth stand-ins: 133 scenario checks pass (anonymous, customers, sellers, admin, service role): bookings and seats, advance/balance, idempotent webhooks, payouts, cancellations and clawbacks, expiry, late payments, chat masking, reviews, strikes, disputes, permissions.
Still to do on your side: run on the real Supabase project; `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;` if you want live chat.
