-- ================================================================
-- ZoomFly v2 — 02 catalog: destinations, policies, commission,
-- packages (workflow), departures + seat counts, public views
-- ================================================================
BEGIN;

CREATE TABLE public.destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE, name text NOT NULL, state text,
  description text, hero_image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT destinations_slug_fmt CHECK (slug = lower(btrim(slug)) AND slug ~ '^[a-z0-9-]+$')
);
CREATE TRIGGER trg_destinations_updated BEFORE UPDATE ON public.destinations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.commission_rates (
  category text PRIMARY KEY CHECK (category IN ('spiritual','domestic','adventure','international','activities')),
  label text NOT NULL,
  rate_pct numeric(5,2) NOT NULL CHECK (rate_pct >= 0 AND rate_pct <= 50),
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_commission_updated BEFORE UPDATE ON public.commission_rates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.commission_rates (category, label, rate_pct) VALUES
  ('spiritual','Spiritual Tours',5), ('domestic','Domestic Tours',7), ('adventure','Adventure Tours',10),
  ('international','International Tours',4), ('activities','Activities',12);

-- Cancellation policies: codes + refund tiers as DATA (edit rows, no migration needed).
-- Rule: the first tier (highest min_days_before first) whose min_days_before <= days until departure applies.
-- PLACEHOLDER VALUES — confirm before launch.
CREATE TABLE public.cancellation_policy_codes (
  code text PRIMARY KEY CHECK (code IN ('flexible','moderate','strict')), label text NOT NULL, summary text NOT NULL
);
CREATE TABLE public.cancellation_policy_tiers (
  code text NOT NULL REFERENCES public.cancellation_policy_codes(code) ON DELETE CASCADE,
  min_days_before integer NOT NULL CHECK (min_days_before >= 0),
  refund_pct integer NOT NULL CHECK (refund_pct BETWEEN 0 AND 100),
  PRIMARY KEY (code, min_days_before)
);
INSERT INTO public.cancellation_policy_codes VALUES
  ('flexible','Flexible','Up to 90% refund, reducing as departure gets closer'),
  ('moderate','Moderate','50% refund if cancelled well before departure'),
  ('strict','Strict','No refund');
INSERT INTO public.cancellation_policy_tiers (code, min_days_before, refund_pct) VALUES
  ('flexible',7,90), ('flexible',3,50), ('flexible',0,0),
  ('moderate',15,50), ('moderate',0,0),
  ('strict',0,0);

-- ---------------- packages ----------------
CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  destination_id uuid REFERENCES public.destinations(id),
  departure_city text, pickup_point text, drop_point text,
  duration_days integer CHECK (duration_days IS NULL OR duration_days > 0),
  nights integer CHECK (nights IS NULL OR nights >= 0),
  tags text[] NOT NULL DEFAULT '{}',
  price_paise bigint CHECK (price_paise IS NULL OR price_paise > 0),   -- per person
  occupancy_basis text,                                                 -- e.g. "per person, twin sharing"
  price_includes_taxes boolean NOT NULL DEFAULT true,
  inclusions text[] NOT NULL DEFAULT '{}', exclusions text[] NOT NULL DEFAULT '{}',
  itinerary jsonb,                                                      -- [{day, title, description}]
  hotel_details text, meal_plan text, vehicle_type text,
  min_group integer, max_group integer, child_policy text,
  difficulty_level text CHECK (difficulty_level IS NULL OR difficulty_level IN ('easy','moderate','hard')),
  high_risk_activities boolean NOT NULL DEFAULT false,
  insurance_provided boolean NOT NULL DEFAULT false, insurance_details text,
  cancellation_policy text REFERENCES public.cancellation_policy_codes(code),
  photos text[] NOT NULL DEFAULT '{}',                                  -- real photos only; min 3 to submit
  -- ZoomFly-controlled
  commission_category text REFERENCES public.commission_rates(category),
  commission_pct numeric(5,2),                                          -- snapshot taken at publish
  listing_status text NOT NULL DEFAULT 'draft'
    CHECK (listing_status IN ('draft','submitted','changes_requested','published','paused','rejected')),
  is_featured boolean NOT NULL DEFAULT false,
  submitted_at timestamptz, reviewed_at timestamptz, reviewed_by uuid REFERENCES public.profiles(id), review_note text,
  rating_avg numeric(3,2), review_count integer NOT NULL DEFAULT 0,    -- NULL rating until real reviews exist
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_packages_seller ON public.packages(seller_id);
CREATE INDEX idx_packages_status ON public.packages(listing_status);
CREATE INDEX idx_packages_destination ON public.packages(destination_id);
CREATE TRIGGER trg_packages_updated BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.packages_make_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(btrim(NEW.slug), '') = '' THEN
    NEW.slug := trim(both '-' from lower(regexp_replace(COALESCE(NEW.title,'package'), '[^a-zA-Z0-9]+', '-', 'g')))
                || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  ELSE
    NEW.slug := lower(btrim(NEW.slug));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_packages_slug BEFORE INSERT ON public.packages FOR EACH ROW EXECUTE FUNCTION public.packages_make_slug();

CREATE OR REPLACE FUNCTION public.package_missing_fields(p public.packages)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE m text[] := ARRAY[]::text[];
BEGIN
  IF COALESCE(btrim(p.title),'') = ''           THEN m := array_append(m, 'title'::text); END IF;
  IF p.destination_id IS NULL                   THEN m := array_append(m, 'destination'::text); END IF;
  IF COALESCE(btrim(p.departure_city),'') = ''  THEN m := array_append(m, 'departure_city'::text); END IF;
  IF COALESCE(btrim(p.occupancy_basis),'') = '' THEN m := array_append(m, 'occupancy_basis'::text); END IF;
  IF COALESCE(p.duration_days,0) <= 0           THEN m := array_append(m, 'duration_days'::text); END IF;
  IF COALESCE(p.price_paise,0) <= 0             THEN m := array_append(m, 'price'::text); END IF;
  IF p.cancellation_policy IS NULL              THEN m := array_append(m, 'cancellation_policy'::text); END IF;
  IF p.itinerary IS NULL OR p.itinerary IN ('[]'::jsonb,'{}'::jsonb,'null'::jsonb) THEN m := array_append(m, 'itinerary'::text); END IF;
  IF COALESCE(array_length(p.inclusions,1),0) = 0 THEN m := array_append(m, 'inclusions'::text); END IF;
  IF COALESCE(array_length(p.exclusions,1),0) = 0 THEN m := array_append(m, 'exclusions'::text); END IF;
  IF COALESCE(array_length(p.photos,1),0) < 3     THEN m := array_append(m, 'photos (minimum 3 real photos)'::text); END IF;
  IF p.high_risk_activities AND NOT p.insurance_provided THEN m := array_append(m, 'insurance (required for high-risk activities)'::text); END IF;
  RETURN m;
END;
$$;

-- Departures table is needed by the workflow trigger's submit check.
CREATE TABLE public.package_departures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  departure_date date NOT NULL, return_date date,
  total_seats integer NOT NULL CHECK (total_seats > 0),
  booked_seats integer NOT NULL DEFAULT 0 CHECK (booked_seats >= 0),   -- includes seats on unpaid holds
  price_override_paise bigint CHECK (price_override_paise IS NULL OR price_override_paise > 0),
  booking_cutoff_days integer NOT NULL DEFAULT 2 CHECK (booking_cutoff_days >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
  cancelled_with_bookings boolean NOT NULL DEFAULT false,              -- feeds the seller cancellation score
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT departures_seats_ok CHECK (booked_seats <= total_seats),
  CONSTRAINT departures_unique UNIQUE (package_id, departure_date)
);
CREATE INDEX idx_departures_open ON public.package_departures(departure_date) WHERE status = 'open';
CREATE TRIGGER trg_departures_updated BEFORE UPDATE ON public.package_departures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- The workflow enforcer: sellers move their packages draft -> submitted only; ZoomFly publishes.
CREATE OR REPLACE FUNCTION public.enforce_package_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_priv boolean := public.is_privileged();
  v_seller uuid; v_missing text[]; v_rate numeric(5,2);
  v_critical boolean := false; v_explicit boolean := false; v_becoming boolean := false;
BEGIN
  IF NOT v_priv THEN
    v_seller := public.live_seller_id();
    IF v_seller IS NULL THEN RAISE EXCEPTION 'Only approved sellers can create or edit packages'; END IF;

    IF TG_OP = 'INSERT' THEN
      NEW.seller_id := v_seller; NEW.listing_status := 'draft'; NEW.is_featured := false;
      NEW.commission_category := NULL; NEW.commission_pct := NULL;
      NEW.reviewed_at := NULL; NEW.reviewed_by := NULL; NEW.review_note := NULL; NEW.submitted_at := NULL;
      NEW.rating_avg := NULL; NEW.review_count := 0;
      RETURN NEW;
    END IF;

    IF OLD.seller_id IS DISTINCT FROM v_seller THEN RAISE EXCEPTION 'You can only edit your own packages'; END IF;
    NEW.seller_id := OLD.seller_id; NEW.is_featured := OLD.is_featured;
    NEW.commission_category := OLD.commission_category; NEW.commission_pct := OLD.commission_pct;
    NEW.reviewed_at := OLD.reviewed_at; NEW.reviewed_by := OLD.reviewed_by; NEW.review_note := OLD.review_note;
    NEW.rating_avg := OLD.rating_avg; NEW.review_count := OLD.review_count;
    IF OLD.listing_status <> 'draft' THEN NEW.slug := OLD.slug; END IF;

    IF NEW.listing_status IS DISTINCT FROM OLD.listing_status THEN
      IF NOT (
           (OLD.listing_status = 'draft'             AND NEW.listing_status = 'submitted')
        OR (OLD.listing_status = 'changes_requested' AND NEW.listing_status = 'submitted')
        OR (OLD.listing_status = 'published'         AND NEW.listing_status = 'paused')
        OR (OLD.listing_status = 'paused'            AND NEW.listing_status = 'published' AND OLD.reviewed_at IS NOT NULL)
        OR (OLD.listing_status = 'rejected'          AND NEW.listing_status = 'draft')
      ) THEN
        RAISE EXCEPTION 'Not allowed: % -> %', OLD.listing_status, NEW.listing_status;
      END IF;
      v_explicit := (NEW.listing_status = 'submitted');
    END IF;

    -- Editing what customers rely on while LIVE sends the listing back to review (hidden until approved).
    -- A price change stays instant: existing bookings keep their own price snapshot.
    IF OLD.listing_status = 'published' AND NEW.listing_status = 'published' THEN
      v_critical := NEW.itinerary IS DISTINCT FROM OLD.itinerary
        OR NEW.inclusions IS DISTINCT FROM OLD.inclusions OR NEW.exclusions IS DISTINCT FROM OLD.exclusions
        OR NEW.cancellation_policy IS DISTINCT FROM OLD.cancellation_policy
        OR NEW.destination_id IS DISTINCT FROM OLD.destination_id
        OR NEW.duration_days IS DISTINCT FROM OLD.duration_days OR NEW.departure_city IS DISTINCT FROM OLD.departure_city
        OR NEW.occupancy_basis IS DISTINCT FROM OLD.occupancy_basis OR NEW.hotel_details IS DISTINCT FROM OLD.hotel_details
        OR NEW.meal_plan IS DISTINCT FROM OLD.meal_plan OR NEW.vehicle_type IS DISTINCT FROM OLD.vehicle_type
        OR NEW.high_risk_activities IS DISTINCT FROM OLD.high_risk_activities
        OR NEW.insurance_provided IS DISTINCT FROM OLD.insurance_provided;
      IF v_critical THEN NEW.listing_status := 'submitted'; END IF;
    END IF;

    IF NEW.listing_status = 'submitted' AND (v_explicit OR v_critical) THEN
      IF NOT public.seller_listing_ready(v_seller) THEN RAISE EXCEPTION 'Your seller verification is not complete yet'; END IF;
      v_missing := public.package_missing_fields(NEW);
      IF array_length(v_missing,1) > 0 THEN RAISE EXCEPTION 'Package incomplete. Missing: %', array_to_string(v_missing, ', '); END IF;
      IF v_explicit AND NOT EXISTS (
        SELECT 1 FROM public.package_departures d WHERE d.package_id = NEW.id AND d.status = 'open'
           AND d.total_seats > d.booked_seats AND d.departure_date >= public.today_ist()
      ) THEN RAISE EXCEPTION 'Add at least one open future departure with seats before submitting'; END IF;
      NEW.submitted_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- admin / server
  v_becoming := (NEW.listing_status = 'published')
    AND (CASE WHEN TG_OP = 'UPDATE' THEN OLD.listing_status IS DISTINCT FROM 'published' ELSE true END);
  IF v_becoming THEN
    IF NEW.commission_category IS NULL THEN RAISE EXCEPTION 'Assign a commission category before publishing'; END IF;
    IF NOT public.seller_listing_ready(NEW.seller_id) THEN RAISE EXCEPTION 'Seller is not fully verified / approved'; END IF;
    v_missing := public.package_missing_fields(NEW);
    IF array_length(v_missing,1) > 0 THEN RAISE EXCEPTION 'Package incomplete. Missing: %', array_to_string(v_missing, ', '); END IF;
    SELECT rate_pct INTO v_rate FROM public.commission_rates WHERE category = NEW.commission_category AND is_active;
    IF v_rate IS NULL THEN RAISE EXCEPTION 'No active commission rate for %', NEW.commission_category; END IF;
    NEW.commission_pct := v_rate;                       -- snapshot at approval
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
    IF COALESCE(NEW.review_count,0) = 0 THEN NEW.rating_avg := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_packages_workflow BEFORE INSERT OR UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_package_workflow();

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY packages_seller_select ON public.packages FOR SELECT USING (seller_id = public.my_seller_id() OR public.is_admin());
CREATE POLICY packages_seller_insert ON public.packages FOR INSERT WITH CHECK (seller_id = public.live_seller_id() OR public.is_admin());
CREATE POLICY packages_seller_update ON public.packages FOR UPDATE USING (seller_id = public.live_seller_id() OR public.is_admin())
  WITH CHECK (seller_id = public.live_seller_id() OR public.is_admin());
CREATE POLICY packages_seller_delete ON public.packages FOR DELETE
  USING ((seller_id = public.my_seller_id() AND listing_status = 'draft') OR public.is_admin());

-- Seats: only the booking functions change booked_seats. They set a transaction-local flag
-- (set_config 'zoomfly.system_op') that this trigger honours.
CREATE OR REPLACE FUNCTION public.seller_owns_package(p_package uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.packages p WHERE p.id = p_package AND p.seller_id = public.my_seller_id());
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_departure_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sys boolean := COALESCE(current_setting('zoomfly.system_op', true), '') = 'on';
        v_priv boolean := public.is_privileged();
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.booked_seats > 0 THEN RAISE EXCEPTION 'This departure has bookings. Cancel it instead of deleting it'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT v_priv THEN
      NEW.booked_seats := 0; NEW.cancelled_with_bookings := false; NEW.cancelled_at := NULL;
      IF NEW.departure_date < public.today_ist() THEN RAISE EXCEPTION 'Departure date cannot be in the past'; END IF;
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE
  IF NOT v_priv AND NOT v_sys THEN
    NEW.booked_seats := OLD.booked_seats; NEW.package_id := OLD.package_id;
    NEW.cancelled_with_bookings := OLD.cancelled_with_bookings; NEW.cancelled_at := OLD.cancelled_at;
    IF NEW.total_seats < OLD.booked_seats THEN RAISE EXCEPTION 'Cannot reduce seats below the % already booked', OLD.booked_seats; END IF;
  END IF;
  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN RAISE EXCEPTION 'A cancelled departure cannot be reopened'; END IF;
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    NEW.cancelled_at := now(); NEW.cancelled_with_bookings := (OLD.booked_seats > 0);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_departures_guard BEFORE INSERT OR UPDATE OR DELETE ON public.package_departures
  FOR EACH ROW EXECUTE FUNCTION public.guard_departure_writes();

ALTER TABLE public.package_departures ENABLE ROW LEVEL SECURITY;
CREATE POLICY departures_seller_all ON public.package_departures FOR ALL
  USING (public.seller_owns_package(package_id) OR public.is_admin())
  WITH CHECK (public.seller_owns_package(package_id) OR public.is_admin());

-- reference data policies
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY destinations_read ON public.destinations FOR SELECT USING (is_active OR public.is_admin());
CREATE POLICY destinations_admin ON public.destinations FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY commission_read ON public.commission_rates FOR SELECT USING (true);
CREATE POLICY commission_admin ON public.commission_rates FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
ALTER TABLE public.cancellation_policy_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cpc_read ON public.cancellation_policy_codes FOR SELECT USING (true);
CREATE POLICY cpc_admin ON public.cancellation_policy_codes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
ALTER TABLE public.cancellation_policy_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY cpt_read ON public.cancellation_policy_tiers FOR SELECT USING (true);
CREATE POLICY cpt_admin ON public.cancellation_policy_tiers FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------- public views (the ONLY way anonymous visitors read catalog data) ----------------
-- A package is visible only if: published, its seller is approved, and it has a bookable departure.
-- Nothing "coming soon", no empty destinations: you only show what is genuinely bookable.
CREATE VIEW public.public_package_departures AS
SELECT d.id, d.package_id, d.departure_date, d.return_date,
       COALESCE(d.price_override_paise, p.price_paise) AS price_paise,
       (d.total_seats - d.booked_seats) AS seats_left
  FROM public.package_departures d
  JOIN public.packages p ON p.id = d.package_id
  JOIN public.sellers s ON s.id = p.seller_id AND s.status = 'approved'
 WHERE p.listing_status = 'published' AND d.status = 'open' AND d.total_seats > d.booked_seats
   AND d.departure_date - d.booking_cutoff_days >= public.today_ist();

CREATE VIEW public.public_packages AS
SELECT p.id, p.slug, p.title, p.description, p.destination_id, dest.slug AS destination_slug, dest.name AS destination_name,
       p.departure_city, p.pickup_point, p.drop_point, p.duration_days, p.nights, p.tags, p.price_paise, p.occupancy_basis,
       p.price_includes_taxes, p.inclusions, p.exclusions, p.itinerary, p.hotel_details, p.meal_plan, p.vehicle_type,
       p.min_group, p.max_group, p.child_policy, p.difficulty_level, p.high_risk_activities, p.insurance_provided,
       p.insurance_details, p.cancellation_policy, p.photos, p.rating_avg, p.review_count, p.is_featured,
       s.id AS seller_id, s.business_name AS seller_name, s.city AS seller_city, s.seller_tier, s.avg_rating AS seller_rating,
       (s.gstin_verified AND s.pan_verified AND s.bank_verified AND s.address_verified AND s.owner_id_verified) AS seller_verified,
       (SELECT min(x.departure_date) FROM public.public_package_departures x WHERE x.package_id = p.id) AS next_departure_date,
       p.created_at
  FROM public.packages p
  JOIN public.sellers s ON s.id = p.seller_id AND s.status = 'approved'
  LEFT JOIN public.destinations dest ON dest.id = p.destination_id
 WHERE p.listing_status = 'published'
   AND EXISTS (SELECT 1 FROM public.public_package_departures x WHERE x.package_id = p.id);

CREATE VIEW public.public_destinations AS
SELECT d.id, d.slug, d.name, d.state, d.description, d.hero_image_url,
       (SELECT count(*) FROM public.public_packages pp WHERE pp.destination_id = d.id) AS package_count
  FROM public.destinations d
 WHERE d.is_active AND EXISTS (SELECT 1 FROM public.public_packages pp WHERE pp.destination_id = d.id);
COMMIT;
