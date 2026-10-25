-- ================================================================
-- ZoomFly v2 — 08 launch gaps
-- terms acceptance records, rate limiting, data (privacy) requests, error log, cron heartbeat,
-- finance summary for the accountant, refund retry, re-submit of a rejected seller application
-- ================================================================
BEGIN;

-- ---------- consent records ----------
ALTER TABLE public.profiles ADD COLUMN terms_accepted_at timestamptz, ADD COLUMN terms_version text;
ALTER TABLE public.bookings ADD COLUMN terms_accepted_at timestamptz, ADD COLUMN terms_version text;
ALTER TABLE public.sellers  ADD COLUMN agreement_accepted_at timestamptz, ADD COLUMN agreement_version text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, terms_accepted_at, terms_version)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.phone,
          CASE WHEN NEW.raw_user_meta_data ->> 'terms_accepted' = 'true' THEN now() END,
          CASE WHEN NEW.raw_user_meta_data ->> 'terms_accepted' = 'true' THEN NEW.raw_user_meta_data ->> 'terms_version' END)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---------- rate limiting (fixed windows; the app asks, the database counts atomically) ----------
CREATE TABLE public.rate_limits (
  key text NOT NULL, bucket bigint NOT NULL, hits integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL,
  PRIMARY KEY (key, bucket)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bucket bigint; v_hits integer;
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_max < 1 OR p_window_seconds < 1 THEN RAISE EXCEPTION 'Bad rate limit'; END IF;
  v_bucket := floor(extract(epoch FROM now()) / p_window_seconds);
  INSERT INTO public.rate_limits (key, bucket, hits, expires_at)
    VALUES (p_key || ':' || p_window_seconds, v_bucket, 1, to_timestamp((v_bucket + 1) * p_window_seconds))
    ON CONFLICT (key, bucket) DO UPDATE SET hits = public.rate_limits.hits + 1
    RETURNING hits INTO v_hits;
  RETURN v_hits <= p_max;     -- false = over the limit
END;
$$;
-- note: key is stored with its window so 5/hour and 30/day for the same key never share a counter
-- (the ON CONFLICT above uses (key, bucket) where key already includes the window)
CREATE OR REPLACE FUNCTION public.purge_rate_limits()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  DELETE FROM public.rate_limits WHERE expires_at < now() - interval '1 day';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ---------- privacy requests (copy of my data / delete my account / correct my data) ----------
CREATE TABLE public.data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('export','delete','correct')),
  note text CHECK (note IS NULL OR length(note) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','declined')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY dr_select ON public.data_requests FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY dr_insert ON public.data_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY dr_admin_update ON public.data_requests FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.data_requests_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_privileged() THEN
    NEW.user_id := auth.uid(); NEW.status := 'open'; NEW.admin_note := NULL; NEW.resolved_at := NULL;
    IF (SELECT count(*) FROM public.data_requests WHERE user_id = NEW.user_id AND status = 'open' AND kind = NEW.kind) > 0 THEN
      RAISE EXCEPTION 'You already have an open request of this kind';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_data_requests_before BEFORE INSERT ON public.data_requests FOR EACH ROW EXECUTE FUNCTION public.data_requests_before_insert();

CREATE OR REPLACE FUNCTION public.data_requests_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._enqueue_email('admin_data_request', '__admin__', jsonb_build_object('kind', NEW.kind, 'note', NEW.note), 'dr:' || NEW.id);
  ELSIF NEW.status <> 'open' AND OLD.status = 'open' THEN
    PERFORM public._enqueue_email('data_request_done', public._user_email(NEW.user_id), jsonb_build_object('kind', NEW.kind, 'status', NEW.status, 'note', NEW.admin_note), 'dr-done:' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_data_requests_notify AFTER INSERT OR UPDATE OF status ON public.data_requests FOR EACH ROW EXECUTE FUNCTION public.data_requests_notify();

-- ---------- error log + cron heartbeat ----------
CREATE TABLE public.app_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), context text NOT NULL, message text NOT NULL, details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_app_errors_created ON public.app_errors (created_at DESC);
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY errors_admin ON public.app_errors FOR SELECT USING (public.is_admin());

CREATE TABLE public.cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job text NOT NULL, ok boolean NOT NULL, summary jsonb, ran_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cron_runs_job ON public.cron_runs (job, ran_at DESC);
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY cron_admin ON public.cron_runs FOR SELECT USING (public.is_admin());

-- Records an error and emails the admin, at most once per context per hour (so a failing loop cannot flood the inbox).
CREATE OR REPLACE FUNCTION public.report_error(p_context text, p_message text, p_details jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  INSERT INTO public.app_errors (context, message, details) VALUES (left(p_context, 120), left(p_message, 1000), p_details);
  PERFORM public._enqueue_email('admin_error', '__admin__', jsonb_build_object('context', left(p_context, 120), 'message', left(p_message, 300)),
                                'err:' || left(p_context, 60) || ':' || floor(extract(epoch FROM now()) / 3600));
END;
$$;

-- ---------- money overview for the accountant ----------
CREATE OR REPLACE FUNCTION public.finance_summary(p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT jsonb_build_object(
    'bookings_created',      (SELECT count(*) FROM public.bookings WHERE created_at::date BETWEEN p_from AND p_to AND status NOT IN ('pending_payment','expired')),
    'booking_value_paise',   (SELECT COALESCE(sum(total_paise), 0) FROM public.bookings WHERE created_at::date BETWEEN p_from AND p_to AND status IN ('confirmed','fully_paid','completed')),
    'commission_paise',      (SELECT COALESCE(sum(commission_paise), 0) FROM public.bookings WHERE created_at::date BETWEEN p_from AND p_to AND status IN ('confirmed','fully_paid','completed')),
    'collected_paise',       (SELECT COALESCE(sum(amount_paise), 0) FROM public.payments WHERE created_at::date BETWEEN p_from AND p_to AND status = 'captured'),
    'refunds_paise',         (SELECT COALESCE(sum(amount_paise), 0) FROM public.refunds WHERE created_at::date BETWEEN p_from AND p_to AND status <> 'failed'),
    'refunds_pending_paise', (SELECT COALESCE(sum(amount_paise), 0) FROM public.refunds WHERE status IN ('pending','processing','failed')),
    'payouts_paid_paise',    (SELECT COALESCE(sum(amount_paise), 0) FROM public.seller_payouts WHERE paid_at::date BETWEEN p_from AND p_to AND status = 'paid'),
    'payouts_due_paise',     (SELECT COALESCE(sum(amount_paise), 0) FROM public.seller_payouts WHERE status IN ('scheduled','released','on_hold')),
    'seller_deductions_paise', (SELECT COALESCE(-sum(amount_paise), 0) FROM public.seller_adjustments WHERE amount_paise < 0)
  ) INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_failed_refund(p_refund uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.refunds SET status = 'pending' WHERE id = p_refund AND status = 'failed';
  IF NOT FOUND THEN RAISE EXCEPTION 'That refund is not in a failed state'; END IF;
END;
$$;

-- A rejected seller fixes their application and sends it again. Only rejected -> pending, only their own row.
CREATE OR REPLACE FUNCTION public.resubmit_seller_application()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.sellers%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.sellers WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR s.status <> 'rejected' THEN RAISE EXCEPTION 'Only a rejected application can be sent again'; END IF;
  PERFORM set_config('zoomfly.system_op', 'on', true);
  UPDATE public.sellers SET status = 'pending', status_note = NULL WHERE id = s.id;
  PERFORM set_config('zoomfly.system_op', 'off', true);
  PERFORM public._enqueue_email('admin_new_seller', '__admin__', jsonb_build_object('business', s.business_name, 'city', s.city, 'seller_id', s.id, 'resubmitted', true),
                                'adm-sel-re:' || s.id || ':' || floor(extract(epoch FROM now()) / 3600));
END;
$$;

-- ---------- permissions ----------
REVOKE ALL ON public.rate_limits, public.data_requests, public.app_errors, public.cron_runs FROM anon, authenticated;
GRANT SELECT, INSERT ON public.data_requests TO authenticated;
GRANT UPDATE ON public.data_requests TO authenticated;                      -- admin-only through the policy
GRANT SELECT ON public.app_errors, public.cron_runs TO authenticated;       -- admin-only through the policies
GRANT ALL ON public.rate_limits, public.data_requests, public.app_errors, public.cron_runs TO service_role;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer), public.purge_rate_limits(), public.report_error(text, text, jsonb),
  public.finance_summary(date, date), public.retry_failed_refund(uuid), public.resubmit_seller_application() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer), public.purge_rate_limits(), public.report_error(text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.finance_summary(date, date), public.retry_failed_refund(uuid) TO authenticated, service_role;   -- admin-checked inside
GRANT EXECUTE ON FUNCTION public.resubmit_seller_application() TO authenticated, service_role;
COMMIT;
