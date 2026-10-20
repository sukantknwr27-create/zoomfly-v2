-- ================================================================
-- ZoomFly v2 — 06 inbox + unread tracking, dispute resolution
-- Own grants below (file 05's blanket revoke ran before these objects existed).
-- ================================================================
BEGIN;

-- ---------- unread tracking ----------
CREATE TABLE public.conversation_reads (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY reads_own ON public.conversation_reads FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = p_conversation
                  AND (c.customer_id = auth.uid() OR c.seller_id = public.my_seller_id())) THEN RETURN; END IF;
  INSERT INTO public.conversation_reads (conversation_id, user_id, last_read_at) VALUES (p_conversation, auth.uid(), now())
    ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = now();
END;
$$;

-- The caller's own conversations (as traveller or as seller), newest first. The only thing a seller learns about the
-- traveller is a first name. The view filters by auth.uid(), so nobody sees anyone else's threads.
CREATE VIEW public.my_conversations AS
SELECT c.id, c.package_id, p.title AS package_title, p.slug AS package_slug, c.seller_id, s.business_name AS seller_name,
       split_part(COALESCE(pr.full_name, 'Traveller'), ' ', 1) AS customer_first_name,
       (c.customer_id = auth.uid()) AS i_am_customer,
       lm.created_at AS last_message_at, left(lm.body, 120) AS last_message_preview,
       (SELECT count(*) FROM public.messages m
         WHERE m.conversation_id = c.id AND m.sender_id <> auth.uid()
           AND m.created_at > COALESCE(r.last_read_at, '-infinity'::timestamptz))::integer AS unread_count,
       c.created_at
  FROM public.conversations c
  JOIN public.packages p ON p.id = c.package_id
  JOIN public.sellers s ON s.id = c.seller_id
  JOIN public.profiles pr ON pr.id = c.customer_id
  LEFT JOIN LATERAL (SELECT body, created_at FROM public.messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) lm ON true
  LEFT JOIN public.conversation_reads r ON r.conversation_id = c.id AND r.user_id = auth.uid()
 WHERE c.customer_id = auth.uid() OR c.seller_id = public.my_seller_id();

-- ---------- dispute resolution ----------
-- Closes a dispute, optionally refunding the customer. A refund is queued for Razorpay and recorded as a deduction
-- against the seller (seller_adjustments), which the payouts screen shows so it can be netted from their next transfer.
CREATE OR REPLACE FUNCTION public.resolve_dispute(p_dispute uuid, p_note text, p_refund_paise bigint DEFAULT 0)
RETURNS public.disputes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.disputes%ROWTYPE; b public.bookings%ROWTYPE; v_already bigint; v_refund bigint := COALESCE(p_refund_paise, 0);
BEGIN
  IF NOT public.is_privileged() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF length(btrim(COALESCE(p_note, ''))) < 10 THEN RAISE EXCEPTION 'Write a resolution note of at least a sentence'; END IF;
  IF v_refund < 0 THEN RAISE EXCEPTION 'Refund cannot be negative'; END IF;
  SELECT * INTO d FROM public.disputes WHERE id = p_dispute FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;
  IF d.status = 'resolved' THEN RAISE EXCEPTION 'This dispute is already resolved'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = d.booking_id FOR UPDATE;
  SELECT COALESCE(sum(amount_paise), 0) INTO v_already FROM public.refunds WHERE booking_id = b.id AND status <> 'failed';
  IF v_refund > b.paid_paise - v_already THEN RAISE EXCEPTION 'Refund is more than can still be refunded (% paise)', b.paid_paise - v_already; END IF;
  IF v_refund > 0 THEN
    INSERT INTO public.refunds (booking_id, customer_id, amount_paise, reason) VALUES (b.id, b.customer_id, v_refund, 'Dispute resolved: ' || left(btrim(p_note), 200));
    INSERT INTO public.seller_adjustments (seller_id, booking_id, amount_paise, reason) VALUES (b.seller_id, b.id, -v_refund, 'Dispute refund on ' || b.booking_ref);
  END IF;
  UPDATE public.disputes SET status = 'resolved', resolution_note = btrim(p_note), resolved_refund_paise = v_refund,
         resolved_by = auth.uid(), resolved_at = now(), first_responded_at = COALESCE(first_responded_at, now())
   WHERE id = d.id RETURNING * INTO d;
  RETURN d;
END;
$$;

-- ---------- permissions ----------
REVOKE ALL ON public.conversation_reads, public.my_conversations FROM anon, authenticated;
GRANT SELECT ON public.my_conversations TO authenticated;
GRANT ALL ON public.conversation_reads, public.my_conversations TO service_role;
REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid), public.resolve_dispute(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid), public.resolve_dispute(uuid, text, bigint) TO authenticated, service_role;
COMMIT;
