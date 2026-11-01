-- ================================================================
-- ZoomFly v2 — 10 activities
-- Activities (day trips, rafting, paragliding, food walks ...) reuse the trip tables, seller verification, review workflow,
-- seat counting, payments, refunds and reviews. What is different:
--   * a package has kind 'package' (default) or 'activity', plus duration in hours, minimum age and an activity type
--   * a departure can have a start time, and one activity can run several slots on the same day
--   * an activity is always paid in full at booking, and the seller is paid once, after the activity
--   * a 1-day-before refund policy (activity_24h). PLACEHOLDER VALUES: confirm before launch.
-- ================================================================
BEGIN;

ALTER TABLE public.packages
  ADD COLUMN kind text NOT NULL DEFAULT 'package' CHECK (kind IN ('package','activity')),
  ADD COLUMN duration_hours numeric(4,1) CHECK (duration_hours IS NULL OR (duration_hours > 0 AND duration_hours <= 72)),
  ADD COLUMN min_age integer CHECK (min_age IS NULL OR (min_age >= 0 AND min_age <= 99)),
  ADD COLUMN activity_type text CHECK (activity_type IS NULL OR activity_type IN
    ('water_sports','adventure','sightseeing','cultural','food','wildlife','day_trip','wellness','other'));
CREATE INDEX idx_packages_kind ON public.packages(kind) WHERE listing_status = 'published';

ALTER TABLE public.package_departures ADD COLUMN start_time time;
ALTER TABLE public.package_departures DROP CONSTRAINT departures_unique;
CREATE UNIQUE INDEX uq_departure_slot ON public.package_departures (package_id, departure_date, (COALESCE(start_time, '00:00'::time)));

ALTER TABLE public.bookings ADD COLUMN departure_time time;   -- snapshot of the slot's start time

-- Refund policy for activities (the first tier whose min_days_before <= days until the activity applies).
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.cancellation_policy_codes'::regclass AND contype = 'c' LOOP
    EXECUTE format('ALTER TABLE public.cancellation_policy_codes DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.cancellation_policy_codes ADD CONSTRAINT cancellation_policy_codes_code_check CHECK (code IN ('flexible','moderate','strict','activity_24h'));
INSERT INTO public.cancellation_policy_codes VALUES ('activity_24h','Activity: free cancellation up to 1 day before','Full refund if cancelled at least 1 day before; no refund after that');
INSERT INTO public.cancellation_policy_tiers (code, min_days_before, refund_pct) VALUES ('activity_24h',1,100), ('activity_24h',0,0);

-- Sellers cannot change what kind of listing something is, and changing what travellers rely on sends a live activity back to review.
CREATE OR REPLACE FUNCTION public.guard_package_kind()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_privileged() THEN NEW.kind := CASE WHEN NEW.kind = 'activity' THEN 'activity' ELSE 'package' END; END IF;
    RETURN NEW;
  END IF;
  IF NOT public.is_privileged() THEN
    NEW.kind := OLD.kind;
    IF OLD.listing_status = 'published' AND NEW.listing_status = 'published'
       AND (NEW.duration_hours IS DISTINCT FROM OLD.duration_hours OR NEW.min_age IS DISTINCT FROM OLD.min_age
            OR NEW.activity_type IS DISTINCT FROM OLD.activity_type OR NEW.pickup_point IS DISTINCT FROM OLD.pickup_point) THEN
      NEW.listing_status := 'submitted'; NEW.submitted_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_packages_zkind BEFORE INSERT OR UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.guard_package_kind();

-- ---------------- booking + payout functions ----------------
CREATE OR REPLACE FUNCTION public.package_missing_fields(p public.packages)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE m text[] := ARRAY[]::text[];
BEGIN
  IF COALESCE(btrim(p.title),'') = ''           THEN m := array_append(m, 'title'::text); END IF;
  IF p.destination_id IS NULL                   THEN m := array_append(m, 'destination'::text); END IF;
  IF COALESCE(btrim(p.departure_city),'') = ''  THEN m := array_append(m, 'departure_city'::text); END IF;
  IF COALESCE(btrim(p.occupancy_basis),'') = '' THEN m := array_append(m, 'occupancy_basis'::text); END IF;
  IF p.kind = 'activity' THEN
    IF COALESCE(p.duration_hours,0) <= 0        THEN m := array_append(m, 'duration (hours)'::text); END IF;
    IF COALESCE(btrim(p.pickup_point),'') = ''  THEN m := array_append(m, 'meeting point'::text); END IF;
  ELSIF COALESCE(p.duration_days,0) <= 0        THEN m := array_append(m, 'duration_days'::text); END IF;
  IF COALESCE(p.price_paise,0) <= 0             THEN m := array_append(m, 'price'::text); END IF;
  IF p.cancellation_policy IS NULL              THEN m := array_append(m, 'cancellation_policy'::text); END IF;
  IF p.kind <> 'activity' AND (p.itinerary IS NULL OR p.itinerary IN ('[]'::jsonb,'{}'::jsonb,'null'::jsonb)) THEN m := array_append(m, 'itinerary'::text); END IF;
  IF COALESCE(array_length(p.inclusions,1),0) = 0 THEN m := array_append(m, 'inclusions'::text); END IF;
  IF COALESCE(array_length(p.exclusions,1),0) = 0 THEN m := array_append(m, 'exclusions'::text); END IF;
  IF COALESCE(array_length(p.photos,1),0) < 3     THEN m := array_append(m, 'photos (minimum 3 real photos)'::text); END IF;
  IF p.high_risk_activities AND NOT p.insurance_provided THEN m := array_append(m, 'insurance (required for high-risk activities)'::text); END IF;
  RETURN m;
END;
$$;


CREATE OR REPLACE FUNCTION public.create_booking(
  p_customer uuid, p_departure uuid, p_adults integer, p_children integer, p_infants integer,
  p_travellers jsonb, p_contact_name text, p_contact_phone text, p_contact_email text)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.package_departures%ROWTYPE; pk public.packages%ROWTYPE; s public.marketplace_settings%ROWTYPE; b public.bookings%ROWTYPE;
  v_seats integer; v_unit bigint; v_total bigint; v_comm bigint; v_adv bigint; v_days integer; v_end date; v_tiers jsonb; v_stale integer := 0; v_booked integer; v_act boolean;
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
  v_act := (pk.kind = 'activity');
  -- an activity slot that has already started is closed
  IF d.start_time IS NOT NULL AND d.departure_date = public.today_ist() AND d.start_time <= (now() AT TIME ZONE 'Asia/Kolkata')::time THEN RAISE EXCEPTION 'This departure is closed for booking'; END IF;
  v_seats := p_adults + p_children;
  IF v_booked + v_seats > d.total_seats THEN RAISE EXCEPTION 'Seats not available'; END IF;
  IF pk.commission_pct IS NULL THEN RAISE EXCEPTION 'Package has no commission snapshot'; END IF;

  SELECT * INTO s FROM public.marketplace_settings;
  v_unit  := COALESCE(d.price_override_paise, pk.price_paise);          -- price comes from the DB, never the client
  v_total := v_unit * v_seats;
  v_comm  := round(v_total * pk.commission_pct / 100.0);
  v_days  := d.departure_date - public.today_ist();
  IF v_act OR v_days <= s.balance_due_days THEN v_adv := v_total;       -- activities are always paid in full                -- too close to departure: pay in full now
  ELSE v_adv := ceil(v_total * s.advance_pct / 100.0); END IF;
  v_end := COALESCE(d.return_date, d.departure_date + GREATEST(pk.duration_days,1) - 1);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('min_days_before', t.min_days_before, 'refund_pct', t.refund_pct)
                            ORDER BY t.min_days_before DESC), '[]'::jsonb)
    INTO v_tiers FROM public.cancellation_policy_tiers t WHERE t.code = pk.cancellation_policy;

  UPDATE public.package_departures SET booked_seats = booked_seats + v_seats WHERE id = d.id;
  INSERT INTO public.bookings (customer_id, seller_id, package_id, departure_id, package_title, departure_date, trip_end_date,
      adults, children, infants, seats, traveller_details, contact_name, contact_phone, contact_email,
      unit_price_paise, total_paise, commission_pct, commission_paise, advance_paise, balance_due_on,
      cancellation_policy, cancellation_tiers, hold_expires_at, departure_time)
  VALUES (p_customer, pk.seller_id, pk.id, d.id, pk.title, d.departure_date, v_end,
      p_adults, p_children, p_infants, v_seats, COALESCE(p_travellers,'[]'::jsonb), btrim(p_contact_name), btrim(p_contact_phone), p_contact_email,
      v_unit, v_total, pk.commission_pct, v_comm, v_adv,
      CASE WHEN v_adv >= v_total THEN NULL ELSE d.departure_date - s.balance_due_days END,
      pk.cancellation_policy, v_tiers, now() + make_interval(mins => s.seat_hold_minutes), d.start_time)
  RETURNING * INTO b;
  RETURN b;
END;
$$;

CREATE OR REPLACE FUNCTION public._schedule_payouts(b public.bookings)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.marketplace_settings%ROWTYPE; v_net bigint; v_m1 bigint; v_m2 bigint; v_act boolean;
BEGIN
  SELECT * INTO s FROM public.marketplace_settings;
  SELECT (kind = 'activity') INTO v_act FROM public.packages WHERE id = b.package_id;
  v_net := b.total_paise - b.commission_paise;
  v_m1 := round(v_net * s.payout_m1_pct / 100.0);
  v_m2 := round(v_net * s.payout_m2_pct / 100.0);
  -- Activities happen within days of booking, so the seller is paid once, after the activity, never before it.
  IF COALESCE(v_act, false) THEN v_m1 := 0; v_m2 := 0; END IF;
  INSERT INTO public.seller_payouts (booking_id, seller_id, milestone, amount_paise, due_on) VALUES
    (b.id, b.seller_id, 'm1', v_m1, CASE WHEN COALESCE(v_act,false) THEN b.trip_end_date ELSE b.departure_date - s.payout_m1_days_before END),
    (b.id, b.seller_id, 'm2', v_m2, CASE WHEN COALESCE(v_act,false) THEN b.trip_end_date ELSE b.departure_date - s.payout_m2_days_before END),
    (b.id, b.seller_id, 'm3', v_net - v_m1 - v_m2, b.trip_end_date + ceil(s.payout_m3_hours_after / 24.0)::int)
  ON CONFLICT (booking_id, milestone) DO NOTHING;
END;
$$;


-- ---------------- public views (new columns are added at the end) ----------------
CREATE OR REPLACE VIEW public.public_package_departures AS
SELECT d.id, d.package_id, d.departure_date, d.return_date,
       COALESCE(d.price_override_paise, p.price_paise) AS price_paise,
       (d.total_seats - d.booked_seats) AS seats_left,
       d.start_time
  FROM public.package_departures d
  JOIN public.packages p ON p.id = d.package_id
  JOIN public.sellers s ON s.id = p.seller_id AND s.status = 'approved'
 WHERE p.listing_status = 'published' AND d.status = 'open' AND d.total_seats > d.booked_seats
   AND d.departure_date - d.booking_cutoff_days >= public.today_ist()
   AND (d.start_time IS NULL OR d.departure_date > public.today_ist() OR d.start_time > (now() AT TIME ZONE 'Asia/Kolkata')::time);

CREATE OR REPLACE VIEW public.public_packages AS
SELECT p.id, p.slug, p.title, p.description, p.destination_id, dest.slug AS destination_slug, dest.name AS destination_name,
       p.departure_city, p.pickup_point, p.drop_point, p.duration_days, p.nights, p.tags, p.price_paise, p.occupancy_basis,
       p.price_includes_taxes, p.inclusions, p.exclusions, p.itinerary, p.hotel_details, p.meal_plan, p.vehicle_type,
       p.min_group, p.max_group, p.child_policy, p.difficulty_level, p.high_risk_activities, p.insurance_provided,
       p.insurance_details, p.cancellation_policy, p.photos, p.rating_avg, p.review_count, p.is_featured,
       s.id AS seller_id, s.business_name AS seller_name, s.city AS seller_city, s.seller_tier, s.avg_rating AS seller_rating,
       (s.gstin_verified AND s.pan_verified AND s.bank_verified AND s.address_verified AND s.owner_id_verified) AS seller_verified,
       (SELECT min(x.departure_date) FROM public.public_package_departures x WHERE x.package_id = p.id) AS next_departure_date,
       p.created_at,
       p.kind, p.duration_hours, p.min_age, p.activity_type
  FROM public.packages p
  JOIN public.sellers s ON s.id = p.seller_id AND s.status = 'approved'
  LEFT JOIN public.destinations dest ON dest.id = p.destination_id
 WHERE p.listing_status = 'published'
   AND EXISTS (SELECT 1 FROM public.public_package_departures x WHERE x.package_id = p.id);


CREATE OR REPLACE VIEW public.seller_bookings AS
SELECT b.id, b.booking_ref, b.package_id, b.package_title, b.departure_id, b.departure_date, b.trip_end_date,
       b.adults, b.children, b.infants, b.seats, b.status, b.total_paise, b.paid_paise, b.commission_paise, b.created_at,
       CASE WHEN b.status IN ('confirmed','fully_paid','completed') THEN b.traveller_details END AS traveller_details,
       CASE WHEN b.status IN ('fully_paid','completed') THEN b.contact_name END AS contact_name,
       CASE WHEN b.status IN ('fully_paid','completed') THEN b.contact_phone END AS contact_phone,
       CASE WHEN b.status IN ('fully_paid','completed') THEN b.contact_email END AS contact_email,
       b.departure_time
  FROM public.bookings b
 WHERE b.seller_id = public.my_seller_id();

COMMIT;
