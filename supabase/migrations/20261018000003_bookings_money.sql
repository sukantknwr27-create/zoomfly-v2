-- ================================================================
-- ZoomFly v2 — 03 bookings, payments, refunds, seller payouts
-- All money in paise. Every state change that moves money or seats
-- happens in a SERVER-ONLY function (service_role / admin), never
-- directly from the browser. Prices are always computed here, from
-- the database, never taken from the client.
-- ================================================================
BEGIN;

CREATE TABLE public.marketplace_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),            -- single row
  advance_pct integer NOT NULL DEFAULT 20 CHECK (advance_pct BETWEEN 1 AND 100),
  balance_due_days integer NOT NULL DEFAULT 21 CHECK (balance_due_days >= 0),  -- balance due this many days before departure
  seat_hold_minutes integer NOT NULL DEFAULT 30 CHECK (seat_hold_minutes > 0),
  payout_m1_pct integer NOT NULL DEFAULT 30, payout_m1_days_before integer NOT NULL DEFAULT 14,
  payout_m2_pct integer NOT NULL DEFAULT 50, payout_m2_days_before integer NOT NULL DEFAULT 7,
  payout_m3_pct integer NOT NULL DEFAULT 20, payout_m3_hours_after integer NOT NULL DEFAULT 48,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payout_split_100 CHECK (payout_m1_pct + payout_m2_pct + payout_m3_pct = 100)
);
INSERT INTO public.marketplace_settings DEFAULT VALUES;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.marketplace_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE SEQUENCE public.booking_ref_seq START 1;

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref text NOT NULL UNIQUE DEFAULT ('ZF' || to_char(now() AT TIME ZONE 'Asia/Kolkata','YYMM') || lpad(nextval('public.booking_ref_seq')::text, 5, '0')),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  package_id uuid NOT NULL REFERENCES public.packages(id),
  departure_id uuid NOT NULL REFERENCES public.package_departures(id),
  package_title text NOT NULL, departure_date date NOT NULL, trip_end_date date NOT NULL,
  adults integer NOT NULL CHECK (adults >= 1), children integer NOT NULL DEFAULT 0 CHECK (children >= 0),
  infants integer NOT NULL DEFAULT 0 CHECK (infants >= 0),
  seats integer NOT NULL CHECK (seats >= 1),                  -- adults + children (infants take no seat)
  traveller_details jsonb NOT NULL DEFAULT '[]',
  contact_name text NOT NULL, contact_phone text NOT NULL, contact_email text,
  unit_price_paise bigint NOT NULL CHECK (unit_price_paise > 0),
  total_paise bigint NOT NULL CHECK (total_paise > 0),
  commission_pct numeric(5,2) NOT NULL, commission_paise bigint NOT NULL,
  advance_paise bigint NOT NULL, balance_due_on date,
  paid_paise bigint NOT NULL DEFAULT 0,
  cancellation_policy text NOT NULL, cancellation_tiers jsonb NOT NULL DEFAULT '[]',   -- snapshot at booking time
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN
    ('pending_payment','confirmed','fully_paid','completed','cancelled_by_customer','cancelled_by_seller','cancelled_by_admin','expired')),
  hold_expires_at timestamptz,
  confirmed_at timestamptz, fully_paid_at timestamptz, completed_at timestamptz, cancelled_at timestamptz, cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_customer ON public.bookings(customer_id);
CREATE INDEX idx_bookings_seller ON public.bookings(seller_id);
CREATE INDEX idx_bookings_departure ON public.bookings(departure_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id), customer_id uuid NOT NULL REFERENCES public.profiles(id),
  kind text NOT NULL CHECK (kind IN ('advance','balance')),
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  razorpay_order_id text, razorpay_payment_id text UNIQUE,    -- UNIQUE = webhook retries cannot double-count
  status text NOT NULL DEFAULT 'captured' CHECK (status IN ('created','captured','failed')),
  needs_review boolean NOT NULL DEFAULT false,                -- money arrived for a booking that was no longer payable
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_booking ON public.payments(booking_id);

CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id), customer_id uuid NOT NULL REFERENCES public.profiles(id),
  amount_paise bigint NOT NULL CHECK (amount_paise > 0), reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  razorpay_refund_id text, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);

CREATE TABLE public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id), seller_id uuid NOT NULL REFERENCES public.sellers(id),
  milestone text NOT NULL CHECK (milestone IN ('m1','m2','m3','cancellation_retained')),
  amount_paise bigint NOT NULL CHECK (amount_paise >= 0),    -- NET to seller (commission already deducted)
  due_on date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','on_hold','released','paid','void')),
  hold_reason text, released_at timestamptz, paid_at timestamptz, utr text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payouts_unique_milestone UNIQUE (booking_id, milestone)
);
CREATE INDEX idx_payouts_due ON public.seller_payouts(due_on) WHERE status = 'scheduled';

CREATE TABLE public.seller_adjustments (   -- e.g. clawback when a refund exceeds what the seller should have kept
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id), booking_id uuid REFERENCES public.bookings(id),
  amount_paise bigint NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------- RLS (read-only for people; the server writes) ----------------
ALTER TABLE public.marketplace_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_read ON public.marketplace_settings FOR SELECT USING (true);
CREATE POLICY settings_admin ON public.marketplace_settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookings_read ON public.bookings FOR SELECT USING (customer_id = auth.uid() OR public.is_admin());
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_read ON public.payments FOR SELECT USING (customer_id = auth.uid() OR public.is_admin());
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY refunds_read ON public.refunds FOR SELECT USING (customer_id = auth.uid() OR public.is_admin());
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY payouts_read ON public.seller_payouts FOR SELECT USING (seller_id = public.my_seller_id() OR public.is_admin());
ALTER TABLE public.seller_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY adjustments_read ON public.seller_adjustments FOR SELECT USING (seller_id = public.my_seller_id() OR public.is_admin());

-- What a seller sees of their bookings: names after confirmation, phone/email only once FULLY PAID.
CREATE VIEW public.seller_bookings AS
SELECT b.id, b.booking_ref, b.package_id, b.package_title, b.departure_id, b.departure_date, b.trip_end_date,
       b.adults, b.children, b.infants, b.seats, b.status, b.total_paise, b.paid_paise, b.commission_paise, b.created_at,
       CASE WHEN b.status IN ('confirmed','fully_paid','completed') THEN b.traveller_details END AS traveller_details,
       CASE WHEN b.status IN ('fully_paid','completed') THEN b.contact_name END AS contact_name,
       CASE WHEN b.status IN ('fully_paid','completed') THEN b.contact_phone END AS contact_phone,
       CASE WHEN b.status IN ('fully_paid','completed') THEN b.contact_email END AS contact_email
  FROM public.bookings b
 WHERE b.seller_id = public.my_seller_id();

-- ---------------- server-only functions ----------------
CREATE OR REPLACE FUNCTION public.create_booking(
  p_customer uuid, p_departure uuid, p_adults integer, p_children integer, p_infants integer,
  p_travellers jsonb, p_contact_name text, p_contact_phone text, p_contact_email text)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.package_departures%ROWTYPE; pk public.packages%ROWTYPE; s public.marketplace_settings%ROWTYPE; b public.bookings%ROWTYPE;
  v_seats integer; v_unit bigint; v_total bigint; v_comm bigint; v_adv bigint; v_days integer; v_end date; v_tiers jsonb; v_stale integer := 0; v_booked integer;
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  PERFORM set_config('zoomfly.system_op', 'on', true);
  IF COALESCE(p_adults,0) < 1 OR COALESCE(p_children,0) < 0 OR COALESCE(p_infants,0) < 0 THEN RAISE EXCEPTION 'Invalid traveller counts'; END IF;
  IF COALESCE(btrim(p_contact_name),'') = '' OR COALESCE(btrim(p_contact_phone),'') = '' THEN RAISE EXCEPTION 'Contact name and phone are required'; END IF;

  SELECT * INTO d FROM public.package_departures WHERE id = p_departure FOR UPDATE;   -- serialises concurrent bookings
  IF NOT FOUND THEN RAISE EXCEPTION 'Departure not found'; END IF;
  -- Free the seats of lapsed unpaid holds on THIS departure first, so a stale hold never blocks a real customer
  -- (the scheduled job does the same thing in bulk).
  WITH stale AS (
    UPDATE public.bookings SET status = 'expired', cancelled_at = now(), cancel_reason = 'Seat hold expired'
     WHERE departure_id = d.id AND status = 'pending_payment' AND hold_expires_at < now() RETURNING seats)
  SELECT COALESCE(sum(seats), 0)::integer INTO v_stale FROM stale;
  IF v_stale > 0 THEN
    UPDATE public.package_departures SET booked_seats = GREATEST(booked_seats - v_stale, 0) WHERE id = d.id;
  END IF;
  v_booked := GREATEST(d.booked_seats - v_stale, 0);
  SELECT * INTO pk FROM public.packages WHERE id = d.package_id AND listing_status = 'published';
  IF NOT FOUND OR NOT public.seller_is_live(pk.seller_id) THEN RAISE EXCEPTION 'This package is not available'; END IF;
  IF d.status <> 'open' OR d.departure_date - d.booking_cutoff_days < public.today_ist() THEN RAISE EXCEPTION 'This departure is closed for booking'; END IF;
  v_seats := p_adults + p_children;
  IF v_booked + v_seats > d.total_seats THEN RAISE EXCEPTION 'Seats not available'; END IF;
  IF pk.commission_pct IS NULL THEN RAISE EXCEPTION 'Package has no commission snapshot'; END IF;

  SELECT * INTO s FROM public.marketplace_settings;
  v_unit  := COALESCE(d.price_override_paise, pk.price_paise);          -- price comes from the DB, never the client
  v_total := v_unit * v_seats;
  v_comm  := round(v_total * pk.commission_pct / 100.0);
  v_days  := d.departure_date - public.today_ist();
  IF v_days <= s.balance_due_days THEN v_adv := v_total;                -- too close to departure: pay in full now
  ELSE v_adv := ceil(v_total * s.advance_pct / 100.0); END IF;
  v_end := COALESCE(d.return_date, d.departure_date + GREATEST(pk.duration_days,1) - 1);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('min_days_before', t.min_days_before, 'refund_pct', t.refund_pct)
                            ORDER BY t.min_days_before DESC), '[]'::jsonb)
    INTO v_tiers FROM public.cancellation_policy_tiers t WHERE t.code = pk.cancellation_policy;

  UPDATE public.package_departures SET booked_seats = booked_seats + v_seats WHERE id = d.id;
  INSERT INTO public.bookings (customer_id, seller_id, package_id, departure_id, package_title, departure_date, trip_end_date,
      adults, children, infants, seats, traveller_details, contact_name, contact_phone, contact_email,
      unit_price_paise, total_paise, commission_pct, commission_paise, advance_paise, balance_due_on,
      cancellation_policy, cancellation_tiers, hold_expires_at)
  VALUES (p_customer, pk.seller_id, pk.id, d.id, pk.title, d.departure_date, v_end,
      p_adults, p_children, p_infants, v_seats, COALESCE(p_travellers,'[]'::jsonb), btrim(p_contact_name), btrim(p_contact_phone), p_contact_email,
      v_unit, v_total, pk.commission_pct, v_comm, v_adv,
      CASE WHEN v_adv >= v_total THEN NULL ELSE d.departure_date - s.balance_due_days END,
      pk.cancellation_policy, v_tiers, now() + make_interval(mins => s.seat_hold_minutes))
  RETURNING * INTO b;
  RETURN b;
END;
$$;

CREATE OR REPLACE FUNCTION public._schedule_payouts(b public.bookings)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.marketplace_settings%ROWTYPE; v_net bigint; v_m1 bigint; v_m2 bigint;
BEGIN
  SELECT * INTO s FROM public.marketplace_settings;
  v_net := b.total_paise - b.commission_paise;
  v_m1 := round(v_net * s.payout_m1_pct / 100.0);
  v_m2 := round(v_net * s.payout_m2_pct / 100.0);
  INSERT INTO public.seller_payouts (booking_id, seller_id, milestone, amount_paise, due_on) VALUES
    (b.id, b.seller_id, 'm1', v_m1, b.departure_date - s.payout_m1_days_before),
    (b.id, b.seller_id, 'm2', v_m2, b.departure_date - s.payout_m2_days_before),
    (b.id, b.seller_id, 'm3', v_net - v_m1 - v_m2, b.trip_end_date + ceil(s.payout_m3_hours_after / 24.0)::int)
  ON CONFLICT (booking_id, milestone) DO NOTHING;
END;
$$;

-- Called by the Razorpay webhook handler. Idempotent on razorpay_payment_id.
CREATE OR REPLACE FUNCTION public.record_payment(p_booking uuid, p_kind text, p_amount bigint, p_order text, p_payment text)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings%ROWTYPE; v_paid bigint;
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_kind NOT IN ('advance','balance') OR COALESCE(p_amount,0) <= 0 THEN RAISE EXCEPTION 'Invalid payment'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF p_payment IS NOT NULL AND EXISTS (SELECT 1 FROM public.payments WHERE razorpay_payment_id = p_payment) THEN RETURN b; END IF;

  IF b.status NOT IN ('pending_payment','confirmed') THEN
    -- Money arrived for an expired/cancelled/complete booking: keep the record and queue a full refund.
    INSERT INTO public.payments (booking_id, customer_id, kind, amount_paise, razorpay_order_id, razorpay_payment_id, needs_review)
      VALUES (b.id, b.customer_id, p_kind, p_amount, p_order, p_payment, true);
    INSERT INTO public.refunds (booking_id, customer_id, amount_paise, reason)
      VALUES (b.id, b.customer_id, p_amount, 'Payment received after booking was no longer payable');
    RETURN b;
  END IF;
  IF b.paid_paise + p_amount > b.total_paise THEN RAISE EXCEPTION 'Payment exceeds the booking total'; END IF;

  INSERT INTO public.payments (booking_id, customer_id, kind, amount_paise, razorpay_order_id, razorpay_payment_id)
    VALUES (b.id, b.customer_id, p_kind, p_amount, p_order, p_payment);
  v_paid := b.paid_paise + p_amount;
  UPDATE public.bookings SET paid_paise = v_paid WHERE id = b.id RETURNING * INTO b;
  IF b.status = 'pending_payment' AND v_paid >= b.advance_paise THEN
    UPDATE public.bookings SET status = 'confirmed', confirmed_at = now(), hold_expires_at = NULL WHERE id = b.id RETURNING * INTO b;
    PERFORM public._schedule_payouts(b);
  END IF;
  IF b.status = 'confirmed' AND v_paid >= b.total_paise THEN
    UPDATE public.bookings SET status = 'fully_paid', fully_paid_at = now() WHERE id = b.id RETURNING * INTO b;
  END IF;
  RETURN b;
END;
$$;

-- Cron: free the seats of unpaid holds.
CREATE OR REPLACE FUNCTION public.expire_unpaid_bookings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  PERFORM set_config('zoomfly.system_op', 'on', true);
  FOR r IN SELECT id, departure_id, seats FROM public.bookings
            WHERE status = 'pending_payment' AND hold_expires_at < now() FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.bookings SET status = 'expired', cancelled_at = now(), cancel_reason = 'Seat hold expired' WHERE id = r.id;
    UPDATE public.package_departures SET booked_seats = GREATEST(booked_seats - r.seats, 0) WHERE id = r.departure_id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- Internal cancel (no auth check) shared by the customer/admin path and the seller-cancels-departure path.
CREATE OR REPLACE FUNCTION public._cancel_booking(p_booking uuid, p_by text, p_reason text, p_refund_pct integer)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings%ROWTYPE; v_pct integer := 0; v_days integer; v_t jsonb; v_refund bigint;
        v_retained bigint; v_ent bigint; v_rel bigint;
BEGIN
  PERFORM set_config('zoomfly.system_op', 'on', true);
  SELECT * INTO b FROM public.bookings WHERE id = p_booking FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF b.status NOT IN ('pending_payment','confirmed','fully_paid') THEN RAISE EXCEPTION 'Booking cannot be cancelled (status: %)', b.status; END IF;
  v_days := b.departure_date - public.today_ist();

  IF p_refund_pct IS NOT NULL THEN v_pct := LEAST(GREATEST(p_refund_pct,0),100);
  ELSIF p_by = 'seller' THEN v_pct := 100;
  ELSE
    FOR v_t IN SELECT x FROM jsonb_array_elements(b.cancellation_tiers) AS x ORDER BY (x->>'min_days_before')::int DESC LOOP
      IF v_days >= (v_t->>'min_days_before')::int THEN v_pct := (v_t->>'refund_pct')::int; EXIT; END IF;
    END LOOP;
  END IF;
  v_refund := floor(b.paid_paise * v_pct / 100.0);
  IF v_refund > 0 THEN
    INSERT INTO public.refunds (booking_id, customer_id, amount_paise, reason) VALUES (b.id, b.customer_id, v_refund, COALESCE(p_reason, 'Booking cancelled'));
  END IF;

  UPDATE public.bookings SET status = 'cancelled_by_' || p_by, cancelled_at = now(), cancel_reason = p_reason, hold_expires_at = NULL
   WHERE id = b.id RETURNING * INTO b;
  UPDATE public.package_departures SET booked_seats = GREATEST(booked_seats - b.seats, 0) WHERE id = b.departure_id;

  -- Seller keeps (paid - refund) less commission on that retained part. Void unreleased payouts,
  -- pay out the difference vs what was already released, or record a clawback.
  v_retained := b.paid_paise - v_refund;
  v_ent := v_retained - round(v_retained * b.commission_pct / 100.0);
  UPDATE public.seller_payouts SET status = 'void' WHERE booking_id = b.id AND status IN ('scheduled','on_hold');
  SELECT COALESCE(sum(amount_paise),0) INTO v_rel FROM public.seller_payouts WHERE booking_id = b.id AND status IN ('released','paid');
  IF v_ent > v_rel THEN
    INSERT INTO public.seller_payouts (booking_id, seller_id, milestone, amount_paise, due_on)
      VALUES (b.id, b.seller_id, 'cancellation_retained', v_ent - v_rel, public.today_ist())
      ON CONFLICT (booking_id, milestone) DO NOTHING;
  ELSIF v_rel > v_ent THEN
    INSERT INTO public.seller_adjustments (seller_id, booking_id, amount_paise, reason)
      VALUES (b.seller_id, b.id, -(v_rel - v_ent), 'Clawback: refund exceeded seller entitlement on cancellation ' || b.booking_ref);
  END IF;
  RETURN b;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking uuid, p_by text, p_reason text DEFAULT NULL, p_refund_pct integer DEFAULT NULL)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_by NOT IN ('customer','seller','admin') THEN RAISE EXCEPTION 'Invalid canceller'; END IF;
  RETURN public._cancel_booking(p_booking, p_by, p_reason, p_refund_pct);
END;
$$;

-- A seller cancels a whole departure: every booking is refunded 100% and the seller's score takes the hit.
CREATE OR REPLACE FUNCTION public.cancel_departure_by_seller(p_departure uuid, p_reason text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.package_departures%ROWTYPE; r record; n integer := 0;
BEGIN
  SELECT * INTO d FROM public.package_departures WHERE id = p_departure FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Departure not found'; END IF;
  IF NOT (public.is_privileged() OR public.seller_owns_package(d.package_id)) THEN RAISE EXCEPTION 'Not your departure'; END IF;
  IF d.status = 'cancelled' THEN RETURN 0; END IF;
  PERFORM set_config('zoomfly.system_op', 'on', true);
  UPDATE public.package_departures SET status = 'cancelled' WHERE id = d.id;
  FOR r IN SELECT id FROM public.bookings WHERE departure_id = d.id AND status IN ('pending_payment','confirmed','fully_paid') LOOP
    PERFORM public._cancel_booking(r.id, 'seller', COALESCE(p_reason, 'Departure cancelled by seller'), NULL);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_due_bookings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.bookings SET status = 'completed', completed_at = now()
   WHERE status = 'fully_paid' AND trip_end_date < public.today_ist();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Marks due payouts 'released' (= approved for transfer). Safety rules:
--  * never release more than ZoomFly has actually collected from the customer (net of commission)
--  * m2/m3 need the booking fully paid; disputes put payouts on_hold so they never match here
CREATE OR REPLACE FUNCTION public.release_due_payouts()
RETURNS SETOF public.seller_payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY
  WITH rel AS (
    UPDATE public.seller_payouts p SET status = 'released', released_at = now()
      FROM public.bookings b
     WHERE p.booking_id = b.id AND p.status = 'scheduled' AND p.due_on <= public.today_ist()
       AND ( p.milestone = 'cancellation_retained'
             OR ( b.status IN ('confirmed','fully_paid','completed')
                  AND (p.milestone = 'm1' OR b.status IN ('fully_paid','completed'))
                  AND (b.paid_paise - b.commission_paise) >=
                      (SELECT COALESCE(sum(x.amount_paise),0) FROM public.seller_payouts x
                        WHERE x.booking_id = p.booking_id AND x.status IN ('released','paid')) + p.amount_paise ) )
    RETURNING p.*)
  SELECT * FROM rel;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_payout_paid(p_payout uuid, p_utr text)
RETURNS public.seller_payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.seller_payouts%ROWTYPE;
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF COALESCE(btrim(p_utr),'') = '' THEN RAISE EXCEPTION 'UTR / bank reference required'; END IF;
  UPDATE public.seller_payouts SET status = 'paid', paid_at = now(), utr = btrim(p_utr)
   WHERE id = p_payout AND status = 'released' RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout is not in released state'; END IF;
  RETURN r;
END;
$$;
COMMIT;
