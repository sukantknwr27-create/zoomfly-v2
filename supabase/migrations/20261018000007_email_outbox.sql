-- ================================================================
-- ZoomFly v2 — 07 email outbox
-- Every email that must go out is first written here, in the SAME transaction as the event that caused it, so an
-- email is never lost and never sent for something that was rolled back. The app drains the table through Resend
-- and retries failures (see web/src/lib/email). Triggers cover every path: webhook, browser call, admin screen, cron.
-- ================================================================
BEGIN;

CREATE TABLE public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template text NOT NULL,
  to_email text NOT NULL,                       -- '__admin__' = the address in ADMIN_NOTIFY_EMAIL
  payload jsonb NOT NULL DEFAULT '{}',
  dedupe_key text UNIQUE,                       -- same key twice = one email (reminders, throttled chat alerts)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  send_after timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbox_pending ON public.email_outbox (send_after) WHERE status = 'pending';
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY outbox_admin ON public.email_outbox FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public._enqueue_email(p_template text, p_to text, p_payload jsonb, p_dedupe text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_to IS NULL OR btrim(p_to) = '' THEN RETURN; END IF;
  INSERT INTO public.email_outbox (template, to_email, payload, dedupe_key) VALUES (p_template, btrim(p_to), COALESCE(p_payload, '{}'::jsonb), p_dedupe)
    ON CONFLICT (dedupe_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public._user_email(p_user uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v text;
BEGIN
  SELECT email INTO v FROM auth.users WHERE id = p_user;
  RETURN v;
END;
$$;

-- ---------- bookings ----------
CREATE OR REPLACE FUNCTION public.notify_booking_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cust text; v_sell text; v_base jsonb; v_refund bigint;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_cust := COALESCE(NULLIF(btrim(NEW.contact_email), ''), public._user_email(NEW.customer_id));
  SELECT email INTO v_sell FROM public.sellers WHERE id = NEW.seller_id;
  v_base := jsonb_build_object('booking_id', NEW.id, 'ref', NEW.booking_ref, 'title', NEW.package_title, 'departure_date', NEW.departure_date,
    'seats', NEW.seats, 'total_paise', NEW.total_paise, 'paid_paise', NEW.paid_paise, 'advance_paise', NEW.advance_paise,
    'balance_due_on', NEW.balance_due_on, 'name', NEW.contact_name, 'first_name', split_part(NEW.contact_name, ' ', 1));

  IF NEW.status = 'confirmed' AND NEW.advance_paise < NEW.total_paise THEN
    PERFORM public._enqueue_email('booking_confirmed', v_cust, v_base, 'bk-conf:' || NEW.id);
    PERFORM public._enqueue_email('seller_new_booking', v_sell, v_base, 'bk-sconf:' || NEW.id);
  ELSIF NEW.status = 'fully_paid' THEN
    PERFORM public._enqueue_email('booking_paid_in_full', v_cust, v_base, 'bk-paid:' || NEW.id);
    PERFORM public._enqueue_email('seller_booking_paid', v_sell, v_base, 'bk-spaid:' || NEW.id);   -- covers a pay-in-full booking too
  ELSIF NEW.status IN ('cancelled_by_customer', 'cancelled_by_seller', 'cancelled_by_admin') THEN
    SELECT amount_paise INTO v_refund FROM public.refunds WHERE booking_id = NEW.id ORDER BY created_at DESC LIMIT 1;
    v_base := v_base || jsonb_build_object('by', replace(NEW.status, 'cancelled_by_', ''), 'refund_paise', COALESCE(v_refund, 0), 'reason', NEW.cancel_reason);
    PERFORM public._enqueue_email('booking_cancelled', v_cust, v_base, 'bk-canc:' || NEW.id);
    PERFORM public._enqueue_email('seller_booking_cancelled', v_sell, v_base, 'bk-scanc:' || NEW.id);
  ELSIF NEW.status = 'completed' THEN
    PERFORM public._enqueue_email('review_request', v_cust, v_base, 'bk-review:' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_bookings_notify AFTER UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.notify_booking_status();

-- ---------- refunds ----------
CREATE OR REPLACE FUNCTION public.notify_refund_done()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings%ROWTYPE;
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    SELECT * INTO b FROM public.bookings WHERE id = NEW.booking_id;
    PERFORM public._enqueue_email('refund_sent', COALESCE(NULLIF(btrim(b.contact_email), ''), public._user_email(NEW.customer_id)),
      jsonb_build_object('booking_id', b.id, 'ref', b.booking_ref, 'title', b.package_title, 'refund_paise', NEW.amount_paise), 'refund:' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_refunds_notify AFTER UPDATE OF status ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.notify_refund_done();

-- ---------- sellers ----------
CREATE OR REPLACE FUNCTION public.notify_seller_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._enqueue_email('seller_application_received', NEW.email, jsonb_build_object('business', NEW.business_name, 'name', NEW.contact_name), 'sel-rcv:' || NEW.id);
  PERFORM public._enqueue_email('admin_new_seller', '__admin__', jsonb_build_object('business', NEW.business_name, 'city', NEW.city, 'seller_id', NEW.id), 'adm-sel:' || NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sellers_notify_insert AFTER INSERT ON public.sellers FOR EACH ROW EXECUTE FUNCTION public.notify_seller_insert();

CREATE OR REPLACE FUNCTION public.notify_seller_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_t := CASE NEW.status WHEN 'approved' THEN 'seller_approved' WHEN 'rejected' THEN 'seller_rejected' WHEN 'suspended' THEN 'seller_suspended' WHEN 'banned' THEN 'seller_banned' END;
  IF v_t IS NOT NULL THEN
    PERFORM public._enqueue_email(v_t, NEW.email, jsonb_build_object('business', NEW.business_name, 'name', NEW.contact_name, 'note', NEW.status_note, 'verification_notes', NEW.verification_notes));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sellers_notify_status AFTER UPDATE OF status ON public.sellers FOR EACH ROW EXECUTE FUNCTION public.notify_seller_status();

-- ---------- packages ----------
CREATE OR REPLACE FUNCTION public.notify_package_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_name text; v_p jsonb;
BEGIN
  IF NEW.listing_status IS NOT DISTINCT FROM OLD.listing_status THEN RETURN NEW; END IF;
  SELECT email, business_name INTO v_email, v_name FROM public.sellers WHERE id = NEW.seller_id;
  v_p := jsonb_build_object('package_id', NEW.id, 'title', NEW.title, 'slug', NEW.slug, 'seller', v_name, 'note', NEW.review_note);
  IF NEW.listing_status = 'submitted' THEN
    PERFORM public._enqueue_email('admin_trip_submitted', '__admin__', v_p);
  ELSIF NEW.listing_status = 'published' AND OLD.listing_status IS DISTINCT FROM 'paused' THEN
    PERFORM public._enqueue_email('trip_published', v_email, v_p);
  ELSIF NEW.listing_status = 'changes_requested' THEN
    PERFORM public._enqueue_email('trip_changes_requested', v_email, v_p);
  ELSIF NEW.listing_status = 'rejected' THEN
    PERFORM public._enqueue_email('trip_rejected', v_email, v_p);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_packages_notify AFTER UPDATE OF listing_status ON public.packages FOR EACH ROW EXECUTE FUNCTION public.notify_package_status();

-- ---------- disputes ----------
CREATE OR REPLACE FUNCTION public.notify_dispute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bookings%ROWTYPE; v_sell text; v_cust text; v_p jsonb;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = NEW.booking_id;
  SELECT email INTO v_sell FROM public.sellers WHERE id = b.seller_id;
  v_cust := COALESCE(NULLIF(btrim(b.contact_email), ''), public._user_email(b.customer_id));
  v_p := jsonb_build_object('dispute_id', NEW.id, 'booking_id', b.id, 'ref', b.booking_ref, 'title', b.package_title, 'reason', left(NEW.reason, 600),
    'by', NEW.opened_by_role, 'note', NEW.resolution_note, 'refund_paise', COALESCE(NEW.resolved_refund_paise, 0));
  IF TG_OP = 'INSERT' THEN
    PERFORM public._enqueue_email('admin_dispute_opened', '__admin__', v_p);
    IF NEW.opened_by_role = 'customer' THEN PERFORM public._enqueue_email('dispute_opened_seller', v_sell, v_p);
    ELSE PERFORM public._enqueue_email('dispute_opened_customer', v_cust, v_p); END IF;
  ELSIF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    PERFORM public._enqueue_email('dispute_resolved', v_cust, v_p, 'dsp-res-c:' || NEW.id);
    PERFORM public._enqueue_email('dispute_resolved', v_sell, v_p, 'dsp-res-s:' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_disputes_notify AFTER INSERT OR UPDATE OF status ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.notify_dispute();

-- ---------- payouts ----------
CREATE OR REPLACE FUNCTION public.notify_payout_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_ref text;
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    SELECT email INTO v_email FROM public.sellers WHERE id = NEW.seller_id;
    SELECT booking_ref INTO v_ref FROM public.bookings WHERE id = NEW.booking_id;
    PERFORM public._enqueue_email('payout_paid', v_email, jsonb_build_object('ref', v_ref, 'amount_paise', NEW.amount_paise, 'utr', NEW.utr, 'milestone', NEW.milestone), 'payout:' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_payouts_notify AFTER UPDATE OF status ON public.seller_payouts FOR EACH ROW EXECUTE FUNCTION public.notify_payout_paid();

-- ---------- chat: at most one alert per conversation, per recipient, per 15 minutes ----------
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.conversations%ROWTYPE; v_to text; v_title text; v_from text; v_bucket bigint;
BEGIN
  SELECT * INTO c FROM public.conversations WHERE id = NEW.conversation_id;
  SELECT title INTO v_title FROM public.packages WHERE id = c.package_id;
  v_bucket := floor(extract(epoch FROM now()) / 900);
  IF NEW.sender_role = 'customer' THEN
    SELECT s.email, split_part(COALESCE(p.full_name, 'A traveller'), ' ', 1) INTO v_to, v_from
      FROM public.sellers s, public.profiles p WHERE s.id = c.seller_id AND p.id = c.customer_id;
  ELSE
    SELECT public._user_email(c.customer_id), s.business_name INTO v_to, v_from FROM public.sellers s WHERE s.id = c.seller_id;
  END IF;
  PERFORM public._enqueue_email('new_message', v_to,
    jsonb_build_object('conversation_id', c.id, 'title', v_title, 'from', v_from, 'to_role', CASE WHEN NEW.sender_role = 'customer' THEN 'seller' ELSE 'customer' END,
                       'snippet', left(NEW.body, 160)),
    'msg:' || c.id || ':' || NEW.sender_role || ':' || v_bucket);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_messages_notify AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- ---------- reminders (run by the daily job; each is sent once thanks to its dedupe key) ----------
CREATE OR REPLACE FUNCTION public.enqueue_due_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0; v_today date := public.today_ist(); v_to text; v_p jsonb;
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  FOR r IN SELECT * FROM public.bookings WHERE status IN ('confirmed', 'fully_paid') LOOP
    v_to := COALESCE(NULLIF(btrim(r.contact_email), ''), public._user_email(r.customer_id));
    v_p := jsonb_build_object('booking_id', r.id, 'ref', r.booking_ref, 'title', r.package_title, 'departure_date', r.departure_date,
      'total_paise', r.total_paise, 'paid_paise', r.paid_paise, 'balance_due_on', r.balance_due_on, 'first_name', split_part(r.contact_name, ' ', 1));
    IF r.status = 'confirmed' AND r.balance_due_on IS NOT NULL THEN
      IF r.balance_due_on - v_today BETWEEN 2 AND 7 THEN
        PERFORM public._enqueue_email('balance_reminder', v_to, v_p, 'bal7:' || r.id); n := n + 1;
      ELSIF r.balance_due_on - v_today BETWEEN 0 AND 1 THEN
        PERFORM public._enqueue_email('balance_reminder', v_to, v_p || '{"urgent": true}', 'bal1:' || r.id); n := n + 1;
      ELSIF r.balance_due_on < v_today THEN
        PERFORM public._enqueue_email('balance_overdue', v_to, v_p, 'bal0:' || r.id);
        PERFORM public._enqueue_email('admin_balance_overdue', '__admin__', v_p, 'adm-bal0:' || r.id); n := n + 1;
      END IF;
    ELSIF r.status = 'fully_paid' AND r.departure_date - v_today = 3 THEN
      PERFORM public._enqueue_email('trip_reminder', v_to, v_p, 'trip3:' || r.id); n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END;
$$;

-- ---------- permissions ----------
REVOKE ALL ON public.email_outbox FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.email_outbox TO authenticated;          -- admin-only through the policy above
GRANT ALL ON public.email_outbox TO service_role;
REVOKE ALL ON FUNCTION public._enqueue_email(text, text, jsonb, text), public._user_email(uuid), public.enqueue_due_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._enqueue_email(text, text, jsonb, text), public._user_email(uuid), public.enqueue_due_reminders() TO service_role;
COMMIT;
