-- ================================================================
-- ZoomFly v2 — 01 core identity: profiles, sellers, verification
-- Fresh project. Run the five files in order (…01 to …05).
-- Money is stored in paise (BIGINT) everywhere, never floats.
-- ================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.today_ist()
RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date $$;

-- ---------------- profiles ----------------
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  phone       text,
  role        text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','seller','admin')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- plpgsql on purpose: SQL-language functions are validated at CREATE time
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' THEN RETURN true; END IF;
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$;

-- Privileged = the server (a service_role request), OR a direct database session (SQL editor / migrations:
-- session_user is postgres), OR an admin, OR one of OUR OWN security-definer functions that has raised the
-- transaction-local flag 'zoomfly.system_op' (clients cannot set it; they can only call allow-listed functions).
-- Fails closed: a request with NO role information is NOT privileged.
CREATE OR REPLACE FUNCTION public.is_privileged()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN COALESCE(auth.role(), '') = 'service_role'
      OR session_user IN ('postgres', 'supabase_admin')
      OR COALESCE(current_setting('zoomfly.system_op', true), '') = 'on'
      OR public.is_admin();
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.phone)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_privileged() THEN NEW.role := OLD.role; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_profiles_protect_role BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- ---------------- sellers ----------------
CREATE TABLE public.sellers (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL UNIQUE REFERENCES public.profiles(id),
  business_name               text NOT NULL,
  contact_name                text NOT NULL,
  email                       text NOT NULL,
  phone                       text NOT NULL,
  whatsapp                    text,
  description                 text,
  logo_url                    text,
  city                        text,
  state                       text,
  pincode                     text,
  address                     text,
  -- verification inputs (seller-supplied)
  gstin                       text,
  pan                         text,
  bank_account_name           text,
  bank_account_number         text,
  bank_ifsc                   text,
  bank_name                   text,
  cancelled_cheque_path       text,
  owner_id_type               text,
  owner_id_path               text,
  travel_registration_number  text,   -- optional; earns the Verified Partner badge
  travel_registration_path    text,
  -- verification checklist (admin-only)
  gstin_verified              boolean NOT NULL DEFAULT false,
  pan_verified                boolean NOT NULL DEFAULT false,
  bank_verified               boolean NOT NULL DEFAULT false,
  address_verified            boolean NOT NULL DEFAULT false,
  owner_id_verified           boolean NOT NULL DEFAULT false,
  verification_notes          text,
  -- standing (admin/server-only)
  status                      text NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected','suspended','banned')),
  status_note                 text,
  approved_at                 timestamptz,
  approved_by                 uuid REFERENCES public.profiles(id),
  seller_tier                 text NOT NULL DEFAULT 'standard' CHECK (seller_tier IN ('standard','verified_partner')),
  strike_count                integer NOT NULL DEFAULT 0,
  ranking_multiplier          numeric(4,2) NOT NULL DEFAULT 1.00,
  avg_rating                  numeric(3,2),
  review_count                integer NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sellers_gstin_format CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  CONSTRAINT sellers_pan_format   CHECK (pan   IS NULL OR pan   ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  CONSTRAINT sellers_ifsc_format  CHECK (bank_ifsc IS NULL OR bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$')
);
CREATE UNIQUE INDEX ux_sellers_gstin ON public.sellers (gstin) WHERE gstin IS NOT NULL;
CREATE INDEX idx_sellers_status ON public.sellers (status);
CREATE TRIGGER trg_sellers_updated BEFORE UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.normalize_seller_ids()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.gstin := NULLIF(upper(btrim(NEW.gstin)), '');
  NEW.pan := NULLIF(upper(btrim(NEW.pan)), '');
  NEW.bank_ifsc := NULLIF(upper(btrim(NEW.bank_ifsc)), '');
  NEW.email := lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sellers_normalize BEFORE INSERT OR UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.normalize_seller_ids();

-- A non-admin can only ever create a pending, unverified seller for THEMSELVES.
CREATE OR REPLACE FUNCTION public.seller_insert_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_privileged() THEN
    NEW.user_id := auth.uid();
    NEW.status := 'pending'; NEW.status_note := NULL; NEW.approved_at := NULL; NEW.approved_by := NULL;
    NEW.gstin_verified := false; NEW.pan_verified := false; NEW.bank_verified := false;
    NEW.address_verified := false; NEW.owner_id_verified := false; NEW.verification_notes := NULL;
    NEW.seller_tier := 'standard'; NEW.strike_count := 0; NEW.ranking_multiplier := 1.00;
    NEW.avg_rating := NULL; NEW.review_count := 0;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sellers_insert_defaults BEFORE INSERT ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.seller_insert_defaults();

-- On UPDATE a seller can edit their business details but nothing privileged,
-- and cannot swap identity/bank data after an admin verified it.
CREATE OR REPLACE FUNCTION public.protect_seller_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_privileged() THEN
    NEW.user_id := OLD.user_id;
    NEW.status := OLD.status; NEW.status_note := OLD.status_note;
    NEW.approved_at := OLD.approved_at; NEW.approved_by := OLD.approved_by;
    NEW.gstin_verified := OLD.gstin_verified; NEW.pan_verified := OLD.pan_verified;
    NEW.bank_verified := OLD.bank_verified; NEW.address_verified := OLD.address_verified;
    NEW.owner_id_verified := OLD.owner_id_verified; NEW.verification_notes := OLD.verification_notes;
    NEW.seller_tier := OLD.seller_tier; NEW.strike_count := OLD.strike_count;
    NEW.ranking_multiplier := OLD.ranking_multiplier;
    NEW.avg_rating := OLD.avg_rating; NEW.review_count := OLD.review_count;
    IF OLD.gstin_verified THEN NEW.gstin := OLD.gstin; END IF;
    IF OLD.pan_verified THEN NEW.pan := OLD.pan; END IF;
    IF OLD.bank_verified THEN
      NEW.bank_account_name := OLD.bank_account_name; NEW.bank_account_number := OLD.bank_account_number;
      NEW.bank_ifsc := OLD.bank_ifsc; NEW.bank_name := OLD.bank_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sellers_protect BEFORE UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.protect_seller_columns();

-- keep profiles.role in step with seller standing
CREATE OR REPLACE FUNCTION public.sync_profile_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE public.profiles SET role = 'seller' WHERE id = NEW.user_id AND role = 'customer';
  ELSIF NEW.status IN ('rejected','banned') THEN
    UPDATE public.profiles SET role = 'customer' WHERE id = NEW.user_id AND role = 'seller';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sellers_sync_role AFTER UPDATE OF status ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role();

-- helpers used by policies (anon is granted EXECUTE in file 05; they return NULL/false for anon)
CREATE OR REPLACE FUNCTION public.my_seller_id()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v uuid;
BEGIN
  SELECT id INTO v FROM public.sellers WHERE user_id = auth.uid() LIMIT 1;
  RETURN v;
END;
$$;
CREATE OR REPLACE FUNCTION public.live_seller_id()   -- the caller's seller id, only while approved
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v uuid;
BEGIN
  SELECT id INTO v FROM public.sellers WHERE user_id = auth.uid() AND status = 'approved' LIMIT 1;
  RETURN v;
END;
$$;
CREATE OR REPLACE FUNCTION public.seller_is_live(p_seller uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.sellers WHERE id = p_seller AND status = 'approved');
END;
$$;
-- May this seller list packages? Approved + full checklist ticked + required documents on file.
-- (Travel registration is optional by design.)
CREATE OR REPLACE FUNCTION public.seller_listing_ready(p_seller uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v public.sellers%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.sellers WHERE id = p_seller;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN v.status = 'approved'
     AND v.gstin_verified AND v.pan_verified AND v.bank_verified AND v.address_verified AND v.owner_id_verified
     AND v.gstin IS NOT NULL AND v.cancelled_cheque_path IS NOT NULL AND v.owner_id_path IS NOT NULL;
END;
$$;

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY sellers_select ON public.sellers FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY sellers_insert ON public.sellers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY sellers_update ON public.sellers FOR UPDATE USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY sellers_admin_delete ON public.sellers FOR DELETE USING (public.is_admin());

-- Curated public seller info: no phone/email/WhatsApp/GSTIN/PAN/bank.
CREATE VIEW public.public_sellers AS
SELECT s.id, s.business_name, s.logo_url, s.description, s.city, s.state, s.seller_tier,
       s.avg_rating, s.review_count,
       (s.gstin_verified AND s.pan_verified AND s.bank_verified AND s.address_verified AND s.owner_id_verified) AS is_verified
  FROM public.sellers s WHERE s.status = 'approved';

-- ---------------- storage ----------------
-- seller-documents: PRIVATE (cheque, owner ID). Path: <auth.uid()>/<file>
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('seller-documents','seller-documents', false, 4194304, ARRAY['image/jpeg','image/png','application/pdf'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
CREATE POLICY "seller docs insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'seller-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "seller docs read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'seller-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "seller docs update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'seller-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "seller docs admin all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'seller-documents' AND public.is_admin()) WITH CHECK (bucket_id = 'seller-documents' AND public.is_admin());
-- package-photos: PUBLIC read; only an approved seller writes into their own folder.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('package-photos','package-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
CREATE POLICY "package photos public read" ON storage.objects FOR SELECT USING (bucket_id = 'package-photos');
CREATE POLICY "package photos seller write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'package-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.live_seller_id() IS NOT NULL);
CREATE POLICY "package photos seller delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'package-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
COMMIT;
