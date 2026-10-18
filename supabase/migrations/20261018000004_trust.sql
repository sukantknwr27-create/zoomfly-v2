-- ================================================================
-- ZoomFly v2 — 04 trust: masked chat, reviews, strikes, disputes,
-- contact reveal
-- ================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.can_access_booking(p_booking uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = p_booking
                  AND (b.customer_id = auth.uid() OR b.seller_id = public.my_seller_id()));
END;
$$;

-- ---------------- chat (phone numbers / emails / links never reach the other side) ----------------
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  package_id uuid NOT NULL REFERENCES public.packages(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, package_id)
);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id),
  sender_role text NOT NULL CHECK (sender_role IN ('customer','seller')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),    -- stored MASKED; this is all the other party ever sees
  flagged boolean NOT NULL DEFAULT false, flag_reasons text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at);
CREATE INDEX idx_messages_flagged ON public.messages(created_at) WHERE flagged;
CREATE TABLE public.message_originals (message_id uuid PRIMARY KEY, original text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());  -- admin eyes only

CREATE OR REPLACE FUNCTION public.mask_contact_info(p_text text, OUT masked text, OUT reasons text[])
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  masked := p_text; reasons := ARRAY[]::text[];
  IF masked ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' THEN
    masked := regexp_replace(masked, '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}', '[email hidden]', 'gi'); reasons := array_append(reasons, 'email'::text);
  END IF;
  IF masked ~* '(https?://|www\.)\S+' OR masked ~* '\m[a-z0-9-]+\.(com|in|net|org|co|io|me)\M' THEN
    masked := regexp_replace(masked, '(https?://\S+|www\.\S+|\m[a-z0-9-]+\.(com|in|net|org|co|io|me)\M\S*)', '[link hidden]', 'gi'); reasons := array_append(reasons, 'link'::text);
  END IF;
  IF masked ~ '(\+?\d[\s.\-()]*){9,}\d' THEN
    masked := regexp_replace(masked, '(\+?\d[\s.\-()]*){9,}\d', '[number hidden]', 'g'); reasons := array_append(reasons, 'phone'::text);
  END IF;
  IF masked ~* '(whats\s*app|wa\.me|telegram|call\s+me|gpay|google\s*pay|phone\s*pe|paytm|\mupi\M|pay\s+directly|direct\s+payment|outside\s+(the\s+)?(app|platform|zoomfly))' THEN
    reasons := array_append(reasons, 'off_platform_keyword'::text);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.messages_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.conversations%ROWTYPE; m record;
BEGIN
  SELECT * INTO c FROM public.conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  IF NOT public.is_privileged() THEN
    NEW.sender_id := auth.uid();
    IF c.customer_id = auth.uid() THEN NEW.sender_role := 'customer';
    ELSIF c.seller_id = public.my_seller_id() THEN NEW.sender_role := 'seller';
    ELSE RAISE EXCEPTION 'You are not part of this conversation'; END IF;
  END IF;
  SELECT * INTO m FROM public.mask_contact_info(NEW.body);
  INSERT INTO public.message_originals (message_id, original) VALUES (NEW.id, NEW.body);
  NEW.body := m.masked; NEW.flag_reasons := m.reasons; NEW.flagged := array_length(m.reasons,1) > 0;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_messages_before_insert BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_before_insert();

CREATE OR REPLACE FUNCTION public.start_conversation(p_package uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pk public.packages%ROWTYPE; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to message the seller'; END IF;
  SELECT * INTO pk FROM public.packages WHERE id = p_package AND listing_status = 'published';
  IF NOT FOUND OR NOT public.seller_is_live(pk.seller_id) THEN RAISE EXCEPTION 'Package not available'; END IF;
  IF pk.seller_id = public.my_seller_id() THEN RAISE EXCEPTION 'You cannot message your own package'; END IF;
  INSERT INTO public.conversations (customer_id, seller_id, package_id) VALUES (auth.uid(), pk.seller_id, pk.id)
    ON CONFLICT (customer_id, package_id) DO NOTHING;
  SELECT id INTO v_id FROM public.conversations WHERE customer_id = auth.uid() AND package_id = pk.id;
  RETURN v_id;
END;
$$;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conv_read ON public.conversations FOR SELECT
  USING (customer_id = auth.uid() OR seller_id = public.my_seller_id() OR public.is_admin());
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY msg_read ON public.messages FOR SELECT USING (
  public.is_admin() OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
                                AND (c.customer_id = auth.uid() OR c.seller_id = public.my_seller_id())));
CREATE POLICY msg_insert ON public.messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
           AND (c.customer_id = auth.uid() OR c.seller_id = public.my_seller_id())));
ALTER TABLE public.message_originals ENABLE ROW LEVEL SECURITY;
CREATE POLICY orig_admin ON public.message_originals FOR SELECT USING (public.is_admin());

-- ---------------- reviews (only after a completed trip; includes "matched the listing") ----------------
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  package_id uuid NOT NULL REFERENCES public.packages(id), seller_id uuid NOT NULL REFERENCES public.sellers(id),
  value_for_money smallint NOT NULL CHECK (value_for_money BETWEEN 1 AND 5),
  hotel_quality smallint CHECK (hotel_quality BETWEEN 1 AND 5),
  transport smallint CHECK (transport BETWEEN 1 AND 5),
  guide_support smallint CHECK (guide_support BETWEEN 1 AND 5),
  matched_listing smallint NOT NULL CHECK (matched_listing BETWEEN 1 AND 5),   -- did the trip match what was advertised?
  overall smallint NOT NULL CHECK (overall BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR length(comment) <= 2000),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.reviews_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = NEW.booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF NOT public.is_privileged() THEN
    IF b.customer_id <> auth.uid() THEN RAISE EXCEPTION 'You can only review your own trip'; END IF;
    NEW.is_published := true;
  END IF;
  IF b.status <> 'completed' THEN RAISE EXCEPTION 'You can review a trip after it is completed'; END IF;
  NEW.customer_id := b.customer_id; NEW.package_id := b.package_id; NEW.seller_id := b.seller_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_reviews_before_insert BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.reviews_before_insert();

CREATE OR REPLACE FUNCTION public.reviews_refresh_aggregates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pkg uuid; v_sel uuid;
BEGIN
  v_pkg := COALESCE(NEW.package_id, OLD.package_id); v_sel := COALESCE(NEW.seller_id, OLD.seller_id);
  PERFORM set_config('zoomfly.system_op', 'on', true);
  UPDATE public.packages SET
    review_count = (SELECT count(*) FROM public.reviews WHERE package_id = v_pkg AND is_published),
    rating_avg   = (SELECT round(avg(overall)::numeric, 2) FROM public.reviews WHERE package_id = v_pkg AND is_published)
  WHERE id = v_pkg;
  UPDATE public.sellers SET
    review_count = (SELECT count(*) FROM public.reviews WHERE seller_id = v_sel AND is_published),
    avg_rating   = (SELECT round(avg(overall)::numeric, 2) FROM public.reviews WHERE seller_id = v_sel AND is_published)
  WHERE id = v_sel;
  PERFORM set_config('zoomfly.system_op', 'off', true);
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_reviews_aggregates AFTER INSERT OR UPDATE OR DELETE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.reviews_refresh_aggregates();

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY reviews_read ON public.reviews FOR SELECT
  USING (customer_id = auth.uid() OR seller_id = public.my_seller_id() OR public.is_admin());
CREATE POLICY reviews_insert ON public.reviews FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY reviews_admin_update ON public.reviews FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE VIEW public.public_reviews AS
SELECT r.id, r.package_id, r.seller_id, r.value_for_money, r.hotel_quality, r.transport, r.guide_support,
       r.matched_listing, r.overall, r.comment, r.created_at, split_part(COALESCE(pr.full_name,'Traveller'), ' ', 1) AS reviewer_first_name
  FROM public.reviews r JOIN public.profiles pr ON pr.id = r.customer_id WHERE r.is_published;

-- ---------------- strikes ----------------
CREATE TABLE public.seller_strikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  reason text NOT NULL CHECK (reason IN ('fake_package','fake_reviews','repeated_cancellation','non_delivery','off_platform','fraud','other')),
  note text, booking_id uuid REFERENCES public.bookings(id), issued_by uuid REFERENCES public.profiles(id),
  voided boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
-- Ladder: 1st strike = warning, 2nd = suspension, 3rd = ban. fake_package / fake_reviews / fraud = immediate ban.
CREATE OR REPLACE FUNCTION public.issue_strike(p_seller uuid, p_reason text, p_note text DEFAULT NULL, p_booking uuid DEFAULT NULL)
RETURNS public.seller_strikes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st public.seller_strikes%ROWTYPE; v_count integer;
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  INSERT INTO public.seller_strikes (seller_id, reason, note, booking_id, issued_by) VALUES (p_seller, p_reason, p_note, p_booking, auth.uid())
    RETURNING * INTO st;
  SELECT count(*) INTO v_count FROM public.seller_strikes WHERE seller_id = p_seller AND NOT voided;
  UPDATE public.sellers SET strike_count = v_count,
    status = CASE WHEN p_reason IN ('fake_package','fake_reviews','fraud') OR v_count >= 3 THEN 'banned'
                  WHEN v_count = 2 THEN 'suspended' ELSE status END,
    status_note = CASE WHEN p_reason IN ('fake_package','fake_reviews','fraud') OR v_count >= 3 THEN 'Banned: ' || p_reason
                       WHEN v_count = 2 THEN 'Suspended: second strike (' || p_reason || ')' ELSE status_note END
  WHERE id = p_seller;
  RETURN st;
END;
$$;
ALTER TABLE public.seller_strikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY strikes_read ON public.seller_strikes FOR SELECT USING (seller_id = public.my_seller_id() OR public.is_admin());

-- ---------------- disputes (48h first response, 7 days to resolve; payouts frozen while open) ----------------
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  opened_by uuid NOT NULL REFERENCES public.profiles(id), opened_by_role text NOT NULL CHECK (opened_by_role IN ('customer','seller')),
  reason text NOT NULL CHECK (length(reason) BETWEEN 10 AND 4000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved')),
  first_response_due timestamptz NOT NULL DEFAULT now() + interval '48 hours',
  resolution_due timestamptz NOT NULL DEFAULT now() + interval '7 days',
  first_responded_at timestamptz, resolution_note text, resolved_refund_paise bigint, resolved_by uuid REFERENCES public.profiles(id), resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_disputes_open ON public.disputes(resolution_due) WHERE status <> 'resolved';
CREATE OR REPLACE FUNCTION public.disputes_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = NEW.booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF NOT public.is_privileged() THEN
    NEW.opened_by := auth.uid(); NEW.status := 'open'; NEW.first_responded_at := NULL; NEW.resolved_at := NULL;
    NEW.resolution_note := NULL; NEW.resolved_refund_paise := NULL; NEW.resolved_by := NULL;
    IF b.customer_id = auth.uid() THEN NEW.opened_by_role := 'customer';
    ELSIF b.seller_id = public.my_seller_id() THEN NEW.opened_by_role := 'seller';
    ELSE RAISE EXCEPTION 'Not your booking'; END IF;
  END IF;
  IF b.status NOT IN ('confirmed','fully_paid','completed','cancelled_by_customer','cancelled_by_seller','cancelled_by_admin') THEN
    RAISE EXCEPTION 'A dispute needs a confirmed booking';
  END IF;
  NEW.first_response_due := now() + interval '48 hours'; NEW.resolution_due := now() + interval '7 days';
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_disputes_before_insert BEFORE INSERT ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.disputes_before_insert();

CREATE OR REPLACE FUNCTION public.disputes_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.seller_payouts SET status = 'on_hold', hold_reason = 'dispute' WHERE booking_id = NEW.booking_id AND status = 'scheduled';
  ELSIF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN
    IF NOT EXISTS (SELECT 1 FROM public.disputes WHERE booking_id = NEW.booking_id AND status <> 'resolved' AND id <> NEW.id) THEN
      UPDATE public.seller_payouts SET status = 'scheduled', hold_reason = NULL
       WHERE booking_id = NEW.booking_id AND status = 'on_hold' AND hold_reason = 'dispute';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_disputes_after_change AFTER INSERT OR UPDATE OF status ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.disputes_after_change();

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY disputes_read ON public.disputes FOR SELECT USING (public.can_access_booking(booking_id) OR public.is_admin());
CREATE POLICY disputes_insert ON public.disputes FOR INSERT WITH CHECK (public.can_access_booking(booking_id));
CREATE POLICY disputes_admin_update ON public.disputes FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------- contact reveal (the "Amazon rule", in one place) ----------------
-- Customer gets the seller's contact + trip contact only once FULLY PAID.
-- Seller gets traveller names once confirmed; the customer's phone/email once FULLY PAID.
CREATE OR REPLACE FUNCTION public.get_booking_contacts(p_booking uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE b public.bookings%ROWTYPE; s public.sellers%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = p_booking;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.sellers WHERE id = b.seller_id;
  IF public.is_admin() THEN
    RETURN jsonb_build_object('seller', jsonb_build_object('business_name', s.business_name, 'phone', s.phone, 'whatsapp', s.whatsapp, 'email', s.email),
      'customer', jsonb_build_object('name', b.contact_name, 'phone', b.contact_phone, 'email', b.contact_email), 'travellers', b.traveller_details);
  ELSIF b.customer_id = auth.uid() THEN
    IF b.status IN ('fully_paid','completed') THEN
      RETURN jsonb_build_object('seller', jsonb_build_object('business_name', s.business_name, 'phone', s.phone, 'whatsapp', s.whatsapp, 'email', s.email));
    END IF;
    RETURN jsonb_build_object('seller', NULL, 'note', 'Seller contact is shared once your booking is fully paid');
  ELSIF b.seller_id = public.my_seller_id() THEN
    IF b.status IN ('fully_paid','completed') THEN
      RETURN jsonb_build_object('travellers', b.traveller_details, 'customer', jsonb_build_object('name', b.contact_name, 'phone', b.contact_phone, 'email', b.contact_email));
    ELSIF b.status = 'confirmed' THEN
      RETURN jsonb_build_object('travellers', b.traveller_details, 'customer', NULL);
    END IF;
    RETURN jsonb_build_object('travellers', NULL, 'customer', NULL);
  END IF;
  RETURN NULL;
END;
$$;
COMMIT;
