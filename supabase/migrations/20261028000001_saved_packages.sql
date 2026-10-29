-- ================================================================
-- ZoomFly v2 — 09 saved trips
-- A signed-in traveller can save trips. Private to them: nobody else, not even sellers, can read a saved list.
-- Deleting a profile or a package removes its saved rows.
-- ================================================================
BEGIN;

CREATE TABLE public.saved_packages (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, package_id)
);
CREATE INDEX idx_saved_packages_user ON public.saved_packages(user_id, created_at DESC);

ALTER TABLE public.saved_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_select ON public.saved_packages FOR SELECT USING (user_id = auth.uid());
CREATE POLICY saved_insert ON public.saved_packages FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY saved_delete ON public.saved_packages FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.saved_packages TO authenticated;
GRANT ALL ON public.saved_packages TO service_role;

COMMIT;
