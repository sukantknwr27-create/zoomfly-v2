-- ================================================================
-- ZoomFly v2 — 05 permissions allowlist
-- Supabase grants ALL on new public objects to anon/authenticated by default.
-- This file removes that and re-grants ONLY what each role needs, so a missing
-- RLS policy can never silently become a data leak. RLS stays the second lock.
-- ================================================================
BEGIN;
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- anonymous visitors: curated views + reference data only
GRANT SELECT ON public.public_sellers, public.public_packages, public.public_package_departures,
                public.public_destinations, public.public_reviews TO anon, authenticated;
GRANT SELECT ON public.commission_rates, public.cancellation_policy_codes, public.cancellation_policy_tiers,
                public.marketplace_settings, public.destinations TO anon, authenticated;

-- signed-in users: RLS decides which rows; admin writes go through admin policies
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sellers, public.packages, public.package_departures TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.destinations, public.commission_rates,
                public.cancellation_policy_codes, public.cancellation_policy_tiers, public.marketplace_settings TO authenticated;  -- admin-only via RLS
GRANT SELECT ON public.bookings, public.payments, public.refunds, public.seller_payouts, public.seller_adjustments,
                public.seller_bookings, public.seller_strikes, public.conversations TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT SELECT ON public.message_originals TO authenticated;                       -- admin-only via RLS
GRANT SELECT, INSERT ON public.reviews TO authenticated; GRANT UPDATE ON public.reviews TO authenticated;  -- update admin-only via RLS
GRANT SELECT, INSERT ON public.disputes TO authenticated; GRANT UPDATE ON public.disputes TO authenticated; -- update admin-only via RLS

-- functions policies/clients call (SECURITY DEFINER bodies check privilege themselves where needed)
GRANT EXECUTE ON FUNCTION public.is_admin(), public.is_privileged(), public.my_seller_id(), public.live_seller_id(),
                public.seller_is_live(uuid), public.seller_owns_package(uuid), public.can_access_booking(uuid),
                public.today_ist() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_conversation(uuid), public.get_booking_contacts(uuid),
                public.cancel_departure_by_seller(uuid, text), public.issue_strike(uuid, text, text, uuid),
                public.mark_payout_paid(uuid, text), public.release_due_payouts(), public.complete_due_bookings(),
                public.cancel_booking(uuid, text, text, integer) TO authenticated;     -- the privileged ones refuse non-admins internally
-- create_booking, record_payment, expire_unpaid_bookings, _cancel_booking, _schedule_payouts stay service_role only.
COMMIT;
