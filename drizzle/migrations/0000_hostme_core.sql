create extension if not exists pg_trgm with schema extensions;

-- ROLES
create type public.app_role as enum ('admin', 'user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

-- ACCOUNTS (one per email; never deleted once something was bought)
create table public.accounts (
  user_id uuid primary key,
  email text not null,
  extra_pages_purchased int not null default 0,
  gift_claimed boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index accounts_email_idx on public.accounts (lower(email));
grant select on public.accounts to authenticated;
grant all on public.accounts to service_role;
alter table public.accounts enable row level security;
create policy "read own account" on public.accounts for select to authenticated using (user_id = auth.uid());

-- HOSTS
create table public.hosts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  slug text not null unique,
  name text not null,
  image_url text not null default '',
  destination_url text,
  tags text[] not null default '{}',
  is_home boolean not null default false,
  is_extra boolean not null default false,
  views int not null default 0,
  stars int not null default 0,
  sparkles int not null default 0,
  entries int not null default 0,
  spies_count int not null default 0,
  extra_slots int not null default 0,
  rent_enabled boolean not null default false,
  auto_spy_guests boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hosts_tags_idx on public.hosts using gin (tags);
create index hosts_owner_idx on public.hosts (owner_id);
grant select on public.hosts to anon, authenticated;
grant update (name, image_url, destination_url, tags, rent_enabled, auto_spy_guests) on public.hosts to authenticated;
grant all on public.hosts to service_role;
alter table public.hosts enable row level security;
create policy "hosts are public" on public.hosts for select to anon, authenticated using (true);
create policy "owners update hosts" on public.hosts for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.owns_host(_host uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hosts where id = _host and owner_id = auth.uid())
$$;

-- BALANCES (private to owner)
create table public.host_balances (
  host_id uuid primary key references public.hosts(id) on delete cascade,
  balance_usd numeric(12,3) not null default 0
);
grant select on public.host_balances to authenticated;
grant all on public.host_balances to service_role;
alter table public.host_balances enable row level security;
create policy "owner reads balance" on public.host_balances for select to authenticated using (public.owns_host(host_id) or public.is_admin());

-- GUESTS (accepted, symmetric rows)
create table public.guests (
  host_id uuid not null references public.hosts(id) on delete cascade,
  guest_id uuid not null references public.hosts(id) on delete cascade,
  entries int not null default 0,
  slot1_count int not null default 0,
  created_at timestamptz not null default now(),
  primary key (host_id, guest_id)
);
grant select on public.guests to anon, authenticated;
grant all on public.guests to service_role;
alter table public.guests enable row level security;
create policy "guests are public" on public.guests for select to anon, authenticated using (true);

-- INVITATIONS (pending)
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  from_host uuid not null references public.hosts(id) on delete cascade,
  to_host uuid not null references public.hosts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_host, to_host)
);
grant select on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;
create policy "parties read invitations" on public.invitations for select to authenticated using (public.owns_host(from_host) or public.owns_host(to_host));

-- SPIES
create table public.spies (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts(id) on delete cascade,
  email text not null,
  user_id uuid,
  created_at timestamptz not null default now()
);
create unique index spies_unique_idx on public.spies (host_id, lower(email));
grant select on public.spies to authenticated;
grant all on public.spies to service_role;
alter table public.spies enable row level security;
create policy "read own spying" on public.spies for select to authenticated using (user_id = auth.uid());

-- GUEST MESSENGERS (email-only participants, no host page)
create table public.guest_messengers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);
create unique index guest_messengers_email_idx on public.guest_messengers (lower(email));
grant all on public.guest_messengers to service_role;
alter table public.guest_messengers enable row level security;

-- MESSAGES
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  from_host_id uuid references public.hosts(id) on delete cascade,
  from_messenger_id uuid references public.guest_messengers(id) on delete cascade,
  to_host_id uuid references public.hosts(id) on delete cascade,
  to_messenger_id uuid references public.guest_messengers(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_to_idx on public.messages (to_host_id, created_at desc);
create index messages_from_idx on public.messages (from_host_id, created_at desc);
grant select on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "parties read messages" on public.messages for select to authenticated using (public.owns_host(from_host_id) or public.owns_host(to_host_id));
create policy "recipient marks read" on public.messages for update to authenticated using (public.owns_host(to_host_id)) with check (public.owns_host(to_host_id));

-- WRITE ANYTHING (one active post per host)
create table public.posts (
  host_id uuid primary key references public.hosts(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts are public" on public.posts for select to anon, authenticated using (true);
create policy "owner inserts post" on public.posts for insert to authenticated with check (public.owns_host(host_id));
create policy "owner updates post" on public.posts for update to authenticated using (public.owns_host(host_id)) with check (public.owns_host(host_id));
create policy "owner deletes post" on public.posts for delete to authenticated using (public.owns_host(host_id));

-- AD CAMPAIGNS
create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  host_id uuid not null references public.hosts(id) on delete cascade,
  kind text not null check (kind in ('hosts', 'hostme')),
  total_impressions int not null default 0,
  remaining_impressions int not null default 0,
  inapp_impressions int not null default 0,
  shared_impressions int not null default 0,
  cpm_price numeric(8,3) not null default 1.000,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (host_id, kind)
);
grant select on public.ad_campaigns to anon, authenticated;
grant all on public.ad_campaigns to service_role;
alter table public.ad_campaigns enable row level security;
create policy "campaigns are public" on public.ad_campaigns for select to anon, authenticated using (true);

-- PURCHASES
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  host_id uuid,
  amount_usd numeric(10,2) not null,
  status text not null default 'paid',
  mode text not null default 'test',
  created_at timestamptz not null default now()
);
grant select on public.purchases to authenticated;
grant all on public.purchases to service_role;
alter table public.purchases enable row level security;
create policy "read own purchases" on public.purchases for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- STATIC PAGES
create table public.static_pages (
  key text primary key,
  slug text not null unique,
  title text not null,
  subtitle text not null default '',
  body text not null default '',
  banner1_url text not null default '',
  banner1_link text not null default '',
  banner2_url text not null default '',
  banner2_link text not null default '',
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.static_pages to anon, authenticated;
grant update on public.static_pages to authenticated;
grant all on public.static_pages to service_role;
alter table public.static_pages enable row level security;
create policy "static pages are public" on public.static_pages for select to anon, authenticated using (true);
create policy "admin edits static pages" on public.static_pages for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- COMMUNITY MICRO-BOARD
create table public.board_posts (
  id uuid primary key default gen_random_uuid(),
  page_key text not null references public.static_pages(key) on delete cascade,
  host_id uuid not null references public.hosts(id) on delete cascade,
  body text not null,
  link text,
  image_url text,
  created_at timestamptz not null default now()
);
create index board_posts_page_idx on public.board_posts (page_key, created_at desc);
grant select on public.board_posts to anon, authenticated;
grant insert, delete on public.board_posts to authenticated;
grant all on public.board_posts to service_role;
alter table public.board_posts enable row level security;
create policy "board is public" on public.board_posts for select to anon, authenticated using (true);
create policy "hosts post on board" on public.board_posts for insert to authenticated with check (public.owns_host(host_id) and length(body) between 1 and 600);
create policy "owner or admin deletes board post" on public.board_posts for delete to authenticated using (public.owns_host(host_id) or public.is_admin());

-- EMAIL OUTBOX (mock mode until a sender is connected)
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  kind text not null,
  subject text not null,
  html text not null,
  payload jsonb not null default '{}',
  status text not null default 'mock',
  created_at timestamptz not null default now()
);
grant select on public.email_outbox to authenticated;
grant all on public.email_outbox to service_role;
alter table public.email_outbox enable row level security;
create policy "admin reads outbox" on public.email_outbox for select to authenticated using (public.is_admin());

-- PENDING SIGNUPS (before email confirmation)
create table public.pending_signups (
  email text primary key,
  name text not null,
  image_url text not null,
  destination_url text,
  created_at timestamptz not null default now()
);
grant all on public.pending_signups to service_role;
alter table public.pending_signups enable row level security;

-- TRACKING (anti-fraud dedupe)
create table public.track_events (
  id bigserial primary key,
  kind text not null,
  target uuid not null,
  extra uuid not null default '00000000-0000-0000-0000-000000000000',
  session_key text not null,
  ip text,
  hour_bucket timestamptz not null,
  created_at timestamptz not null default now(),
  unique (kind, target, extra, session_key, hour_bucket)
);
create index track_events_ip_idx on public.track_events (kind, target, extra, ip, hour_bucket);
grant all on public.track_events to service_role;
alter table public.track_events enable row level security;

-- ===== helper functions =====
create or replace function public.request_ip() returns text language plpgsql stable as $$
declare h json;
begin
  begin
    h := current_setting('request.headers', true)::json;
  exception when others then return null;
  end;
  if h is null then return null; end if;
  return coalesce(h->>'cf-connecting-ip', split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1), h->>'x-real-ip');
end $$;

create or replace function public.track_once(p_kind text, p_target uuid, p_extra uuid, p_session text, p_ip text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_bucket timestamptz := date_trunc('hour', now()); v_extra uuid := coalesce(p_extra, '00000000-0000-0000-0000-000000000000');
begin
  if p_ip is not null and p_ip <> '' and exists (
    select 1 from public.track_events where kind = p_kind and target = p_target and extra = v_extra and ip = p_ip and hour_bucket = v_bucket
  ) then return false; end if;
  insert into public.track_events (kind, target, extra, session_key, ip, hour_bucket)
  values (p_kind, p_target, v_extra, p_session, nullif(p_ip, ''), v_bucket)
  on conflict do nothing;
  return found;
end $$;

create or replace function public.make_slug(p_name text) returns text language sql volatile as $$
  select coalesce(nullif(trim(both '-' from left(regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'), 40)), ''), 'host') || '-' || substr(md5(random()::text), 1, 5)
$$;

create or replace function public.normalize_tags(p_tags text[]) returns text[] language sql immutable as $$
  select coalesce(array_agg(t order by ord), '{}') from (
    select distinct on (t) t, ord from (
      select left(regexp_replace(lower(trim(both '#' from trim(x))), '[^a-z0-9\-]+', '', 'g'), 32) as t, ord
      from unnest(p_tags) with ordinality as u(x, ord)
    ) s where t <> '' order by t, ord
  ) d
$$;

-- hosts validation + image change side effects
create or replace function public.hosts_before_write() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.tags := public.normalize_tags(new.tags);
  if array_length(new.tags, 1) > 13 then raise exception 'A host can have at most 13 tags'; end if;
  new.name := trim(new.name);
  if length(new.name) < 1 or length(new.name) > 60 then raise exception 'Name must be 1-60 characters'; end if;
  if tg_op = 'UPDATE' then
    if old.is_home then new.name := 'Hostme'; end if;
    if new.image_url is distinct from old.image_url and old.image_url <> '' and not old.is_home then
      new.views := 0; new.stars := 0; new.sparkles := 0; new.entries := 0;
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger hosts_before_write before insert or update on public.hosts for each row execute function public.hosts_before_write();

create or replace function public.esc_html(p text) returns text language sql immutable as $$
  select replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;

create or replace function public.hosts_after_write() returns trigger language plpgsql security definer set search_path = public as $$
declare v_count int := 0; v_owner_email text; r record;
begin
  if tg_op = 'INSERT' then
    insert into public.host_balances (host_id) values (new.id) on conflict do nothing;
    return new;
  end if;
  if new.image_url is distinct from old.image_url and new.image_url <> '' then
    if old.image_url <> '' and not old.is_home then
      delete from public.guests where host_id = new.id or guest_id = new.id;
    end if;
    for r in select email from public.spies where host_id = new.id loop
      insert into public.email_outbox (to_email, kind, subject, html, payload)
      values (r.email, 'spy_banner_update', new.name || ' has a new banner on Hostme',
        '<p><strong>' || public.esc_html(new.name) || '</strong> just changed their banner.</p><img src="' || new.image_url || '" width="600" style="aspect-ratio:16/9;object-fit:cover"/><p><a href="{{base_url}}/' || new.slug || '">Visit the Hostpage</a></p>',
        jsonb_build_object('host_id', new.id, 'slug', new.slug));
      v_count := v_count + 1;
    end loop;
    for r in select a.email from public.guests g join public.hosts h on h.id = g.host_id join public.accounts a on a.user_id = h.owner_id
             where g.guest_id = new.id and h.auto_spy_guests loop
      insert into public.email_outbox (to_email, kind, subject, html, payload)
      values (r.email, 'auto_spy_guest_update', 'Your guest ' || new.name || ' changed their banner',
        '<img src="' || new.image_url || '" width="600"/><p><a href="{{base_url}}/' || new.slug || '">See it</a></p>', jsonb_build_object('host_id', new.id));
    end loop;
    select a.email into v_owner_email from public.accounts a where a.user_id = new.owner_id;
    if v_owner_email is not null then
      insert into public.email_outbox (to_email, kind, subject, html, payload)
      values (v_owner_email, 'banner_updated', 'Your new Hostme banner is live',
        '<img src="' || new.image_url || '" width="600"/><p>' || v_count || ' spies were notified.</p><p><a href="{{base_url}}/' || new.slug || '">Open my Hostpage</a></p>',
        jsonb_build_object('host_id', new.id, 'spies_notified', v_count));
    end if;
  end if;
  return new;
end $$;
create trigger hosts_after_write after insert or update on public.hosts for each row execute function public.hosts_after_write();

-- spies counter
create or replace function public.spies_counter() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.hosts set spies_count = spies_count + 1 where id = new.host_id; return new;
  else update public.hosts set spies_count = greatest(0, spies_count - 1) where id = old.host_id; return old; end if;
end $$;
create trigger spies_counter after insert or delete on public.spies for each row execute function public.spies_counter();

-- new guest -> spy alerts
create or replace function public.guests_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare h record; g record; r record;
begin
  select * into h from public.hosts where id = new.host_id;
  select * into g from public.hosts where id = new.guest_id;
  for r in select email from public.spies where host_id = new.host_id loop
    insert into public.email_outbox (to_email, kind, subject, html, payload)
    values (r.email, 'spy_new_guest', h.name || ' has a new guest on Hostme',
      '<p>' || public.esc_html(h.name) || ' welcomed <strong>' || public.esc_html(g.name) || '</strong>.</p><img src="' || g.image_url || '" width="600"/><p><a href="{{base_url}}/' || h.slug || '">Visit the Hostpage</a></p>',
      jsonb_build_object('host_id', h.id, 'guest_id', g.id));
  end loop;
  return new;
end $$;
create trigger guests_after_insert after insert on public.guests for each row execute function public.guests_after_insert();

-- new message -> email notification
create or replace function public.messages_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare v_to text; v_from text;
begin
  if new.to_host_id is not null then
    select a.email into v_to from public.hosts h join public.accounts a on a.user_id = h.owner_id where h.id = new.to_host_id;
  elsif new.to_messenger_id is not null then
    select email into v_to from public.guest_messengers where id = new.to_messenger_id;
  end if;
  if new.from_host_id is not null then select name into v_from from public.hosts where id = new.from_host_id; end if;
  v_from := coalesce(v_from, 'A visitor');
  if v_to is not null then
    insert into public.email_outbox (to_email, kind, subject, html, payload)
    values (v_to, 'new_message', 'New message on Hostme from ' || v_from,
      '<p><strong>' || public.esc_html(v_from) || '</strong> wrote:</p><blockquote>' || public.esc_html(new.body) || '</blockquote><p><a href="{{base_url}}/messages">Open my messages</a></p>',
      jsonb_build_object('message_id', new.id));
  end if;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages for each row execute function public.messages_after_insert();

-- posts validation
create or replace function public.posts_before_write() returns trigger language plpgsql as $$
begin
  new.body := trim(new.body);
  if length(new.body) < 1 or length(new.body) > 1000 then raise exception 'Post must be 1-1000 characters'; end if;
  new.created_at := now();
  return new;
end $$;
create trigger posts_before_write before insert or update on public.posts for each row execute function public.posts_before_write();

-- ===== auth lifecycle =====
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_old uuid;
begin
  select user_id into v_old from public.accounts where lower(email) = lower(coalesce(new.email, ''));
  if v_old is not null and v_old <> new.id then
    update public.accounts set user_id = new.id where user_id = v_old;
    update public.hosts set owner_id = new.id where owner_id = v_old;
  elsif v_old is null then
    insert into public.accounts (user_id, email) values (new.id, coalesce(new.email, '')) on conflict (user_id) do nothing;
  end if;
  if lower(coalesce(new.email, '')) = 'ruchbaba@hotmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
    update public.hosts set owner_id = new.id where is_home;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ===== RPCs: accounts & hosts =====
create or replace function public.email_status(p_email text) returns text language sql stable security definer set search_path = public as $$
  select case when exists (
    select 1 from public.accounts a join public.hosts h on h.owner_id = a.user_id where lower(a.email) = lower(trim(p_email))
  ) or lower(trim(p_email)) = 'ruchbaba@hotmail.com' then 'host' else 'none' end
$$;

create or replace function public.start_signup(p_email text, p_name text, p_image_url text, p_destination text)
returns text language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p_email));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return 'invalid_email'; end if;
  if public.email_status(v_email) = 'host' then return 'taken'; end if;
  if length(trim(coalesce(p_name, ''))) < 1 or length(trim(p_name)) > 60 then return 'invalid_name'; end if;
  if coalesce(p_image_url, '') = '' then return 'missing_image'; end if;
  insert into public.pending_signups (email, name, image_url, destination_url) values (v_email, trim(p_name), p_image_url, nullif(trim(coalesce(p_destination, '')), ''))
  on conflict (email) do update set name = excluded.name, image_url = excluded.image_url, destination_url = excluded.destination_url, created_at = now();
  return 'ok';
end $$;

create or replace function public.page_quota() returns json language plpgsql stable security definer set search_path = public as $$
declare v_owned int; v_extra int;
begin
  if auth.uid() is null then return null; end if;
  select count(*) into v_owned from public.hosts where owner_id = auth.uid() and not is_home;
  select extra_pages_purchased into v_extra from public.accounts where user_id = auth.uid();
  return json_build_object('owned', v_owned, 'quota', 1 + coalesce(v_extra, 0), 'is_admin', public.is_admin());
end $$;

create or replace function public.create_host(p_name text, p_image_url text, p_destination text)
returns text language plpgsql security definer set search_path = public as $$
declare v_owned int; v_extra int; v_slug text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if coalesce(p_image_url, '') = '' then raise exception 'An image is required'; end if;
  select count(*) into v_owned from public.hosts where owner_id = auth.uid() and not is_home;
  select extra_pages_purchased into v_extra from public.accounts where user_id = auth.uid();
  if not public.is_admin() and v_owned >= 1 + coalesce(v_extra, 0) then raise exception 'quota'; end if;
  v_slug := public.make_slug(p_name);
  insert into public.hosts (owner_id, slug, name, image_url, destination_url, is_extra)
  values (auth.uid(), v_slug, p_name, p_image_url, nullif(trim(coalesce(p_destination, '')), ''), v_owned >= 1);
  return v_slug;
end $$;

create or replace function public.claim_signup() returns text language plpgsql security definer set search_path = public as $$
declare v_email text; p record; v_slug text; v_owned int;
begin
  if auth.uid() is null then return null; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  select * into p from public.pending_signups where email = v_email;
  select count(*) into v_owned from public.hosts where owner_id = auth.uid() and not is_home;
  if p.email is not null and (v_owned = 0 or public.is_admin()) then
    v_slug := public.make_slug(p.name);
    insert into public.hosts (owner_id, slug, name, image_url, destination_url, is_extra)
    values (auth.uid(), v_slug, p.name, p.image_url, p.destination_url, v_owned >= 1);
    delete from public.pending_signups where email = v_email;
    return v_slug;
  end if;
  delete from public.pending_signups where email = v_email;
  return (select slug from public.hosts where owner_id = auth.uid() order by is_home, created_at limit 1);
end $$;

create or replace function public.delete_host(p_host uuid) returns text language plpgsql security definer set search_path = public as $$
declare h record; v_bal numeric;
begin
  select * into h from public.hosts where id = p_host;
  if h.id is null or h.owner_id is distinct from auth.uid() then return 'forbidden'; end if;
  if h.is_home then return 'forbidden'; end if;
  select balance_usd into v_bal from public.host_balances where host_id = p_host;
  if coalesce(v_bal, 0) > 0 or exists (select 1 from public.ad_campaigns where host_id = p_host and remaining_impressions > 0) then
    return 'blocked';
  end if;
  delete from public.hosts where id = p_host;
  return 'ok';
end $$;

-- slot stats
create or replace function public.host_slot_stats(p_host uuid) returns json language plpgsql stable security definer set search_path = public as $$
declare g int; cap int; r int; rent boolean;
begin
  select 8 + extra_slots, rent_enabled into cap, rent from public.hosts where id = p_host;
  if cap is null then return null; end if;
  select count(*) into g from public.guests where host_id = p_host;
  r := case when rent then greatest(0, least(g / 2, cap - g)) else 0 end;
  return json_build_object('guests', g, 'capacity', cap, 'rented', r, 'free', cap - g - r, 'rent_enabled', rent, 'max_rentable', greatest(0, least(g / 2, cap - g)));
end $$;

create or replace function public.host_guests(p_host uuid)
returns table (id uuid, slug text, name text, image_url text, views int, tags text[], entries int, slot1_count int)
language sql stable security definer set search_path = public as $$
  select h.id, h.slug, h.name, h.image_url, h.views, h.tags, g.entries, g.slot1_count
  from public.guests g join public.hosts h on h.id = g.guest_id
  where g.host_id = p_host
  order by g.entries desc, g.slot1_count desc, g.created_at asc
$$;

create or replace function public.host_invitations(p_host uuid)
returns table (id uuid, direction text, other_id uuid, slug text, name text, image_url text, views int)
language sql stable security definer set search_path = public as $$
  select i.id, case when i.from_host = p_host then 'out' else 'in' end, h.id, h.slug, h.name, h.image_url, h.views
  from public.invitations i join public.hosts h on h.id = case when i.from_host = p_host then i.to_host else i.from_host end
  where public.owns_host(p_host) and (i.from_host = p_host or i.to_host = p_host)
  order by i.created_at desc
$$;

create or replace function public.relation_status(p_from uuid, p_to uuid) returns text language sql stable security definer set search_path = public as $$
  select case
    when not public.owns_host(p_from) then 'none'
    when exists (select 1 from public.guests where host_id = p_from and guest_id = p_to) then 'partner'
    when exists (select 1 from public.invitations where from_host = p_from and to_host = p_to) then 'pending_out'
    when exists (select 1 from public.invitations where from_host = p_to and to_host = p_from) then 'pending_in'
    else 'none' end
$$;

create or replace function public.send_invite(p_from uuid, p_to uuid) returns text language plpgsql security definer set search_path = public as $$
declare s1 json; s2 json;
begin
  if not public.owns_host(p_from) then return 'forbidden'; end if;
  if p_from = p_to then return 'self'; end if;
  if exists (select 1 from public.guests where host_id = p_from and guest_id = p_to) then return 'partner'; end if;
  if exists (select 1 from public.invitations where (from_host = p_from and to_host = p_to) or (from_host = p_to and to_host = p_from)) then return 'exists'; end if;
  s1 := public.host_slot_stats(p_from); s2 := public.host_slot_stats(p_to);
  if (s1->>'free')::int <= 0 then return 'full_self'; end if;
  if (s2->>'free')::int <= 0 then return 'full_target'; end if;
  insert into public.invitations (from_host, to_host) values (p_from, p_to);
  return 'ok';
end $$;

create or replace function public.accept_invite(p_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare i record;
begin
  select * into i from public.invitations where id = p_id;
  if i.id is null or not public.owns_host(i.to_host) then return 'forbidden'; end if;
  if (public.host_slot_stats(i.to_host)->>'free')::int <= 0 then return 'full_self'; end if;
  if (public.host_slot_stats(i.from_host)->>'free')::int <= 0 then return 'full_target'; end if;
  insert into public.guests (host_id, guest_id) values (i.to_host, i.from_host), (i.from_host, i.to_host) on conflict do nothing;
  delete from public.invitations where id = p_id;
  return 'ok';
end $$;

create or replace function public.decline_invite(p_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare i record;
begin
  select * into i from public.invitations where id = p_id;
  if i.id is null or not (public.owns_host(i.to_host) or public.owns_host(i.from_host)) then return 'forbidden'; end if;
  delete from public.invitations where id = p_id;
  return 'ok';
end $$;

create or replace function public.remove_guest(p_host uuid, p_guest uuid) returns text language plpgsql security definer set search_path = public as $$
begin
  if not (public.owns_host(p_host) or public.owns_host(p_guest)) then return 'forbidden'; end if;
  delete from public.guests where (host_id = p_host and guest_id = p_guest) or (host_id = p_guest and guest_id = p_host);
  delete from public.invitations where (from_host = p_host and to_host = p_guest) or (from_host = p_guest and to_host = p_host);
  return 'ok';
end $$;

-- spies
create or replace function public.spy_on(p_host uuid, p_email text) returns text language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if auth.uid() is not null then select email into v_email from public.accounts where user_id = auth.uid(); end if;
  v_email := lower(trim(coalesce(v_email, p_email, '')));
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return 'invalid_email'; end if;
  insert into public.spies (host_id, email, user_id) values (p_host, v_email, auth.uid()) on conflict do nothing;
  return 'ok';
end $$;

create or replace function public.stop_spy(p_host uuid, p_email text) returns text language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if auth.uid() is not null then select email into v_email from public.accounts where user_id = auth.uid(); end if;
  v_email := lower(trim(coalesce(v_email, p_email, '')));
  delete from public.spies where host_id = p_host and lower(email) = v_email;
  return 'ok';
end $$;

-- messages
create or replace function public.send_message(p_from uuid, p_to_host uuid, p_to_messenger uuid, p_body text) returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_host(p_from) then return 'forbidden'; end if;
  if length(trim(coalesce(p_body, ''))) < 1 or length(p_body) > 2000 then return 'invalid'; end if;
  if p_to_host is null and p_to_messenger is null then return 'invalid'; end if;
  insert into public.messages (from_host_id, to_host_id, to_messenger_id, body) values (p_from, p_to_host, p_to_messenger, trim(p_body));
  return 'ok';
end $$;

create or replace function public.send_message_anon(p_email text, p_to_host uuid, p_body text) returns text language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_id uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return 'invalid_email'; end if;
  if length(trim(coalesce(p_body, ''))) < 1 or length(p_body) > 2000 then return 'invalid'; end if;
  insert into public.guest_messengers (email) values (v_email) on conflict ((lower(email))) do nothing;
  select id into v_id from public.guest_messengers where lower(email) = v_email;
  insert into public.messages (from_messenger_id, to_host_id, body) values (v_id, p_to_host, trim(p_body));
  return 'ok';
end $$;

-- ===== purchases (test mode until a payment provider is connected) =====
create or replace function public.record_purchase(p_kind text, p_host uuid, p_amount numeric) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.purchases (user_id, kind, host_id, amount_usd, status, mode)
  values (auth.uid(), p_kind, p_host, case when public.is_admin() then 0 else p_amount end, case when public.is_admin() then 'comped' else 'paid' end, 'test');
end $$;

create or replace function public.buy_extra_page() returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'forbidden'; end if;
  update public.accounts set extra_pages_purchased = extra_pages_purchased + 1 where user_id = auth.uid();
  perform public.record_purchase('extra_page', null, 29.99);
  return 'ok';
end $$;

create or replace function public.buy_extra_slot(p_host uuid) returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_host(p_host) then return 'forbidden'; end if;
  update public.hosts set extra_slots = extra_slots + 1 where id = p_host;
  perform public.record_purchase('extra_slot', p_host, 9.99);
  return 'ok';
end $$;

create or replace function public.buy_impressions(p_host uuid, p_kind text) returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_host(p_host) then return 'forbidden'; end if;
  if p_kind not in ('hosts', 'hostme') then return 'invalid'; end if;
  insert into public.ad_campaigns (owner_id, host_id, kind, total_impressions, remaining_impressions)
  values (auth.uid(), p_host, p_kind, 10000, 10000)
  on conflict (host_id, kind) do update set total_impressions = ad_campaigns.total_impressions + 10000,
    remaining_impressions = ad_campaigns.remaining_impressions + 10000, active = true;
  perform public.record_purchase('impressions_' || p_kind, p_host, 10.00);
  return 'ok';
end $$;

create or replace function public.gift_status() returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'remaining', greatest(0, 5000 - (select count(*) from public.accounts where gift_claimed)),
    'claimed', coalesce((select gift_claimed from public.accounts where user_id = auth.uid()), false))
$$;

create or replace function public.claim_gift(p_host uuid) returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_host(p_host) then return 'forbidden'; end if;
  if (select gift_claimed from public.accounts where user_id = auth.uid()) then return 'claimed'; end if;
  if (select count(*) from public.accounts where gift_claimed) >= 5000 then return 'over'; end if;
  update public.accounts set gift_claimed = true where user_id = auth.uid();
  insert into public.ad_campaigns (owner_id, host_id, kind, total_impressions, remaining_impressions)
  values (auth.uid(), p_host, 'hostme', 10000, 10000)
  on conflict (host_id, kind) do update set total_impressions = ad_campaigns.total_impressions + 10000,
    remaining_impressions = ad_campaigns.remaining_impressions + 10000, active = true;
  insert into public.purchases (user_id, kind, host_id, amount_usd, status, mode) values (auth.uid(), 'gift_hostme_impressions', p_host, 0, 'gift', 'test');
  return 'ok';
end $$;

-- ===== tracking =====
create or replace function public.track_view(p_host uuid, p_session text, p_ref uuid default null, p_src text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_ip text := public.request_ip(); v_owner uuid;
begin
  if p_session is null or length(p_session) < 8 then return; end if;
  if public.track_once('view', p_host, null, p_session, v_ip) then
    update public.hosts set views = views + 1 where id = p_host;
  end if;
  if p_src = 'embed' then
    v_owner := coalesce(p_ref, p_host);
    if public.track_once('entry', v_owner, p_host, p_session, v_ip) then
      update public.hosts set entries = entries + 1, stars = stars + 1 where id = v_owner;
      if p_ref is not null and p_ref <> p_host then
        update public.hosts set views = views + 1 where id = p_ref;
        update public.guests set entries = entries + 1 where host_id = p_host and guest_id = p_ref;
      end if;
    end if;
  elsif p_ref is not null and p_ref <> p_host then
    if public.track_once('slot1', p_host, p_ref, p_session, v_ip) then
      update public.guests set slot1_count = slot1_count + 1 where host_id = p_host and guest_id = p_ref;
    end if;
  end if;
end $$;

create or replace function public.track_shared_impression(p_host uuid, p_session text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_session is null or length(p_session) < 8 then return; end if;
  if public.track_once('sparkle', p_host, null, p_session, public.request_ip()) then
    update public.hosts set sparkles = sparkles + 1 where id = p_host;
  end if;
end $$;

create or replace function public.track_impression(p_campaign uuid, p_host uuid, p_context text, p_session text)
returns void language plpgsql security definer set search_path = public as $$
declare c record; v_ctx text := case when p_context = 'shared' then 'shared' else 'inapp' end;
begin
  if p_session is null or length(p_session) < 8 then return; end if;
  select * into c from public.ad_campaigns where id = p_campaign and active and remaining_impressions > 0;
  if c.id is null then return; end if;
  if p_host is not null and p_host = c.host_id then return; end if;
  if not public.track_once('imp_' || v_ctx, p_campaign, p_host, p_session, public.request_ip()) then return; end if;
  update public.ad_campaigns set remaining_impressions = remaining_impressions - 1,
    inapp_impressions = inapp_impressions + case when v_ctx = 'inapp' then 1 else 0 end,
    shared_impressions = shared_impressions + case when v_ctx = 'shared' then 1 else 0 end,
    active = remaining_impressions - 1 > 0
  where id = p_campaign and remaining_impressions > 0;
  if c.kind = 'hosts' and p_host is not null and exists (select 1 from public.hosts where id = p_host and rent_enabled) then
    update public.host_balances set balance_usd = balance_usd + 0.001 where host_id = p_host;
  end if;
end $$;

-- ===== stats, search, sponsors =====
create or replace function public.get_global_stats() returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'entries', coalesce((select sum(entries) from public.hosts), 0),
    'earnings', coalesce((select sum(balance_usd) from public.host_balances), 0))
$$;

create or replace function public.tag_suggestions(p_prefix text) returns table (tag text, n bigint)
language sql stable security definer set search_path = public as $$
  select t, count(*) from public.hosts, unnest(tags) as t
  where length(coalesce(p_prefix, '')) > 0 and t like lower(trim(both '#' from p_prefix)) || '%'
  group by t order by count(*) desc, t limit 8
$$;

create or replace function public.search_hosts(p_q text, p_terms text[], p_min_views int, p_min_stars int, p_min_entries int, p_limit int, p_offset int)
returns setof public.hosts language sql stable security definer set search_path = public, extensions as $$
  select h.* from public.hosts h
  where not h.is_home and h.image_url <> ''
    and h.views >= coalesce(p_min_views, 0) and h.stars >= coalesce(p_min_stars, 0) and h.entries >= coalesce(p_min_entries, 0)
    and (
      coalesce(trim(p_q), '') = ''
      or h.tags && coalesce(p_terms, '{}')
      or word_similarity(lower(p_q), lower(h.name || ' ' || array_to_string(h.tags, ' '))) > 0.3
    )
  order by
    (select count(*) from unnest(h.tags) t where t = any(coalesce(p_terms, '{}'))) desc,
    word_similarity(lower(coalesce(p_q, '')), lower(h.name || ' ' || array_to_string(h.tags, ' '))) desc,
    h.views desc, h.id
  limit least(coalesce(p_limit, 12), 48) offset coalesce(p_offset, 0)
$$;

create or replace function public.discover_hosts(p_seed text, p_min_views int, p_min_stars int, p_min_entries int, p_limit int, p_offset int)
returns setof public.hosts language sql stable security definer set search_path = public as $$
  select h.* from public.hosts h
  where not h.is_home and h.image_url <> ''
    and h.views >= coalesce(p_min_views, 0) and h.stars >= coalesce(p_min_stars, 0) and h.entries >= coalesce(p_min_entries, 0)
  order by md5(h.id::text || coalesce(p_seed, ''))
  limit least(coalesce(p_limit, 12), 48) offset coalesce(p_offset, 0)
$$;

create or replace function public.pick_sponsors(p_kind text, p_tags text[], p_exclude uuid[], p_limit int)
returns table (campaign_id uuid, host_id uuid, slug text, name text, image_url text, views int, tags text[])
language sql volatile security definer set search_path = public as $$
  select c.id, h.id, h.slug, h.name, h.image_url, h.views, h.tags
  from public.ad_campaigns c join public.hosts h on h.id = c.host_id
  where c.kind = p_kind and c.active and c.remaining_impressions > 0 and h.image_url <> ''
    and not (h.id = any(coalesce(p_exclude, '{}')))
  order by (h.tags && coalesce(p_tags, '{}')) desc, random()
  limit least(coalesce(p_limit, 2), 24)
$$;

-- ===== seeds =====
insert into public.hosts (slug, name, image_url, is_home, tags) values ('hostme', 'Hostme', '', true, '{hostme,community,traffic}');

insert into public.static_pages (key, slug, title, subtitle, body, sort) values
('how-it-works', 'how-it-works', 'How it works', 'Share slots, exchange audiences.', 'Start a Host with one 16:9 banner. Invite other Hosts as guests, and every banner you share becomes a door that sends people to the whole network.', 1),
('manifesto', 'manifesto', 'Manifesto', 'Visual space is collective momentum.', 'We believe attention grows when it is shared. Every Host lends a window, and every window opens somewhere new.', 2),
('use-cases', 'use-cases', 'Use cases', 'Creators, makers, small businesses, causes.', 'Newsletter swaps, design barters, local shops cross-promoting, open-source projects lifting each other up.', 3),
('submit-story', 'submit-story', 'Submit your story', 'Tell us how Hostme moved you.', 'Share how a guest swap, a sponsor slot or a shared banner changed your traffic. Post below on the community board.', 4),
('invite', 'invite', 'Invite', 'Bring your partners in.', 'Invite people you already collaborate with. Every new Host widens the doors for everyone.', 5),
('faq', 'faq', 'FAQ', 'Short answers to common questions.', 'How many guests can I have? Eight to start, more any time. What is an entry port? A visit that arrives through your shared banner.', 6),
('history', 'history', 'History', 'Where Hostme comes from.', 'Banner exchanges built the early web. Hostme brings that generosity back with fair counting and transparent earnings.', 7),
('our-story', 'our-story', 'Our story', 'Every banner is a window to somewhere.', 'Hostme started as a simple idea: what if every page could host a few friends?', 8);

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.posts;
