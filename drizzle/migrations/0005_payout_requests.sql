CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paypal_email text NOT NULL,
  amount_usd numeric NOT NULL CHECK (amount_usd > 0),
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX payout_requests_user_idx ON public.payout_requests (user_id, created_at DESC);
CREATE INDEX payout_requests_status_idx ON public.payout_requests (status, created_at DESC);

GRANT SELECT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or admin payouts" ON public.payout_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- Host asks for a payout: the whole balance of every page they own moves into one request.
CREATE OR REPLACE FUNCTION public.request_payout(p_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_total numeric := 0;
  v_breakdown jsonb := '{}'::jsonb;
  r record;
BEGIN
  IF v_uid IS NULL THEN RETURN 'login_required'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 200 THEN RETURN 'invalid_email'; END IF;
  FOR r IN
    SELECT b.host_id, b.balance_usd FROM public.host_balances b
    JOIN public.hosts h ON h.id = b.host_id
    WHERE h.owner_id = v_uid AND b.balance_usd > 0
    FOR UPDATE OF b
  LOOP
    v_total := v_total + r.balance_usd;
    v_breakdown := v_breakdown || jsonb_build_object(r.host_id::text, r.balance_usd);
    UPDATE public.host_balances SET balance_usd = 0 WHERE host_id = r.host_id;
  END LOOP;
  IF v_total <= 0 THEN RETURN 'no_balance'; END IF;
  INSERT INTO public.payout_requests (user_id, paypal_email, amount_usd, breakdown)
  VALUES (v_uid, v_email, v_total, v_breakdown);
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.request_payout(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_payout(text) TO authenticated;

-- Admin settles a request: 'paid' closes it, 'reject' puts the money back on the host's pages.
CREATE OR REPLACE FUNCTION public.decide_payout(p_id uuid, p_action text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.payout_requests;
  v_fallback uuid;
  v_left numeric := 0;
  k text; v numeric;
BEGIN
  IF NOT public.is_admin() THEN RETURN 'forbidden'; END IF;
  IF p_action NOT IN ('paid','reject') THEN RETURN 'invalid_action'; END IF;
  SELECT * INTO v_req FROM public.payout_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_req.status <> 'pending' THEN RETURN 'already_decided'; END IF;
  IF p_action = 'paid' THEN
    UPDATE public.payout_requests SET status = 'paid', decided_at = now() WHERE id = p_id;
    RETURN 'ok';
  END IF;
  FOR k, v IN SELECT key, value::numeric FROM jsonb_each_text(v_req.breakdown) LOOP
    IF EXISTS (SELECT 1 FROM public.hosts WHERE id = k::uuid AND owner_id = v_req.user_id) THEN
      INSERT INTO public.host_balances (host_id, balance_usd) VALUES (k::uuid, v)
      ON CONFLICT (host_id) DO UPDATE SET balance_usd = public.host_balances.balance_usd + EXCLUDED.balance_usd;
    ELSE
      v_left := v_left + v;
    END IF;
  END LOOP;
  IF v_left > 0 THEN
    SELECT id INTO v_fallback FROM public.hosts WHERE owner_id = v_req.user_id ORDER BY is_home DESC, created_at LIMIT 1;
    IF v_fallback IS NOT NULL THEN
      INSERT INTO public.host_balances (host_id, balance_usd) VALUES (v_fallback, v_left)
      ON CONFLICT (host_id) DO UPDATE SET balance_usd = public.host_balances.balance_usd + EXCLUDED.balance_usd;
    END IF;
  END IF;
  UPDATE public.payout_requests SET status = 'rejected', decided_at = now() WHERE id = p_id;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.decide_payout(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decide_payout(uuid, text) TO authenticated;

-- Creator earnings = money still on pages + money requested or already paid out.
CREATE OR REPLACE FUNCTION public.get_global_stats()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select json_build_object(
    'entries', coalesce((select sum(entries) from public.hosts), 0),
    'earnings', coalesce((select sum(balance_usd) from public.host_balances), 0)
              + coalesce((select sum(amount_usd) from public.payout_requests where status in ('pending','paid')), 0))
$$;