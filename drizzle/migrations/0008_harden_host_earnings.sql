-- Host earnings ($0.001 per Sponsor-with-Hosts impression) are now limited per visitor connection,
-- so rotating made-up session strings can no longer inflate a balance.
create index if not exists track_events_earn_idx on public.track_events (kind, ip, created_at);

alter table public.payout_requests add column if not exists visitor_count int not null default 0;

create or replace function public.track_impression(p_campaign uuid, p_host uuid, p_context text, p_session text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c record;
  v_ctx text := case when p_context = 'shared' then 'shared' else 'inapp' end;
  v_ip text := nullif(public.request_ip(), '');
  v_uid uuid := auth.uid();
  v_pays boolean := false;
begin
  if p_session is null or length(p_session) < 8 or length(p_session) > 100 then return; end if;
  -- Every counted impression must come from an identifiable visitor connection.
  if v_ip is null then return; end if;
  select * into c from public.ad_campaigns where id = p_campaign and active and remaining_impressions > 0;
  if c.id is null then return; end if;
  if p_host is not null and p_host = c.host_id then return; end if;

  if c.kind = 'hosts' and p_host is not null then
    v_pays := exists (select 1 from public.hosts where id = p_host and rent_enabled and (v_uid is null or owner_id <> v_uid));
    if v_pays then
      -- One connection may earn any single page at most 5 times a day, and all pages at most 30 times a day.
      if (select count(*) from public.track_events where kind = 'earn' and ip = v_ip and target = p_host and created_at > now() - interval '1 day') >= 5
         or (select count(*) from public.track_events where kind = 'earn' and ip = v_ip and created_at > now() - interval '1 day') >= 30 then
        return;
      end if;
    end if;
  end if;

  if not public.track_once('imp_' || v_ctx, p_campaign, p_host, p_session, v_ip) then return; end if;

  update public.ad_campaigns set remaining_impressions = remaining_impressions - 1,
    inapp_impressions = inapp_impressions + case when v_ctx = 'inapp' then 1 else 0 end,
    shared_impressions = shared_impressions + case when v_ctx = 'shared' then 1 else 0 end,
    active = remaining_impressions - 1 > 0
  where id = p_campaign and remaining_impressions > 0;
  if not found then return; end if;

  if v_pays then
    insert into public.track_events (kind, target, extra, session_key, ip, hour_bucket)
    values ('earn', p_host, p_campaign, p_session, v_ip, date_trunc('hour', now()));
    update public.host_balances set balance_usd = balance_usd + 0.001 where host_id = p_host;
  end if;
end $function$;

create or replace function public.request_payout(p_email text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_total numeric := 0;
  v_breakdown jsonb := '{}'::jsonb;
  v_visitors int := 0;
  r record;
begin
  if v_uid is null then return 'login_required'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then return 'invalid_email'; end if;
  for r in
    select b.host_id, b.balance_usd from public.host_balances b
    join public.hosts h on h.id = b.host_id
    where h.owner_id = v_uid and b.balance_usd > 0
    for update of b
  loop
    v_total := v_total + r.balance_usd;
    v_breakdown := v_breakdown || jsonb_build_object(r.host_id::text, r.balance_usd);
    update public.host_balances set balance_usd = 0 where host_id = r.host_id;
  end loop;
  if v_total <= 0 then return 'no_balance'; end if;
  -- How many different visitor connections produced these earnings (last 90 days), shown to the admin for review.
  select count(distinct e.ip) into v_visitors from public.track_events e
  where e.kind = 'earn' and e.created_at > now() - interval '90 days'
    and e.target in (select h.id from public.hosts h where h.owner_id = v_uid);
  insert into public.payout_requests (user_id, paypal_email, amount_usd, breakdown, visitor_count)
  values (v_uid, v_email, v_total, v_breakdown, v_visitors);
  return 'ok';
end $function$;

revoke all on function public.track_impression(uuid, uuid, text, text) from public;
grant execute on function public.track_impression(uuid, uuid, text, text) to anon, authenticated, service_role;
revoke all on function public.request_payout(text) from public, anon;
grant execute on function public.request_payout(text) to authenticated, service_role;