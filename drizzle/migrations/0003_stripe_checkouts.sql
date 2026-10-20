CREATE TABLE public.stripe_checkouts (
  session_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('extra_page','extra_slot','impressions_hosts','impressions_hostme')),
  host_id uuid,
  amount_usd numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','expired')),
  mode text NOT NULL DEFAULT 'test',
  created_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz
);
GRANT SELECT ON public.stripe_checkouts TO authenticated;
GRANT ALL ON public.stripe_checkouts TO service_role;
ALTER TABLE public.stripe_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own checkouts" ON public.stripe_checkouts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX stripe_checkouts_user_status_idx ON public.stripe_checkouts (user_id, status);

-- Grants the purchased item exactly once for a paid Stripe session. Server-only.
CREATE OR REPLACE FUNCTION public.fulfill_checkout(p_session text, p_mode text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  c public.stripe_checkouts%rowtype;
begin
  update public.stripe_checkouts
     set status = 'fulfilled', fulfilled_at = now(), mode = coalesce(p_mode, mode)
   where session_id = p_session and status = 'pending'
   returning * into c;
  if not found then return 'already'; end if;

  if c.kind = 'extra_page' then
    update public.accounts set extra_pages_purchased = extra_pages_purchased + 1 where user_id = c.user_id;
  elsif c.kind = 'extra_slot' then
    update public.hosts set extra_slots = extra_slots + 1 where id = c.host_id and owner_id = c.user_id;
  else
    insert into public.ad_campaigns (owner_id, host_id, kind, total_impressions, remaining_impressions)
    values (c.user_id, c.host_id, substring(c.kind from 13), 10000, 10000)
    on conflict (host_id, kind) do update set total_impressions = ad_campaigns.total_impressions + 10000,
      remaining_impressions = ad_campaigns.remaining_impressions + 10000, active = true;
  end if;

  insert into public.purchases (user_id, kind, host_id, amount_usd, status, mode)
  values (c.user_id, c.kind, c.host_id, c.amount_usd, 'paid', c.mode);
  return 'ok';
end $$;
REVOKE ALL ON FUNCTION public.fulfill_checkout(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_checkout(text, text) TO service_role;

-- Instant purchases are now owner-only (comped); everyone else pays through Stripe.
CREATE OR REPLACE FUNCTION public.buy_extra_page()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if auth.uid() is null then return 'forbidden'; end if;
  if not public.is_admin() then return 'payment_required'; end if;
  update public.accounts set extra_pages_purchased = extra_pages_purchased + 1 where user_id = auth.uid();
  perform public.record_purchase('extra_page', null, 29.99);
  return 'ok';
end $$;

CREATE OR REPLACE FUNCTION public.buy_extra_slot(p_host uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if not public.owns_host(p_host) then return 'forbidden'; end if;
  if not public.is_admin() then return 'payment_required'; end if;
  update public.hosts set extra_slots = extra_slots + 1 where id = p_host;
  perform public.record_purchase('extra_slot', p_host, 9.99);
  return 'ok';
end $$;

CREATE OR REPLACE FUNCTION public.buy_impressions(p_host uuid, p_kind text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if not public.owns_host(p_host) then return 'forbidden'; end if;
  if p_kind not in ('hosts', 'hostme') then return 'invalid'; end if;
  if not public.is_admin() then return 'payment_required'; end if;
  insert into public.ad_campaigns (owner_id, host_id, kind, total_impressions, remaining_impressions)
  values (auth.uid(), p_host, p_kind, 10000, 10000)
  on conflict (host_id, kind) do update set total_impressions = ad_campaigns.total_impressions + 10000,
    remaining_impressions = ad_campaigns.remaining_impressions + 10000, active = true;
  perform public.record_purchase('impressions_' || p_kind, p_host, 10.00);
  return 'ok';
end $$;
REVOKE EXECUTE ON FUNCTION public.buy_extra_page() FROM anon;
REVOKE EXECUTE ON FUNCTION public.buy_extra_slot(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.buy_impressions(uuid, text) FROM anon;