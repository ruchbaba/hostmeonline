-- 1) Shared banner clicks open the banner owner's page; the clicked guest gets the bonus view and slot #1.
create or replace function public.track_view(p_host uuid, p_session text, p_ref uuid default null, p_src text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ip text := public.request_ip();
begin
  if p_session is null or length(p_session) < 8 or length(p_session) > 100 then return; end if;
  if public.track_once('view', p_host, null, p_session, v_ip) then
    update public.hosts set views = views + 1 where id = p_host;
  end if;
  if p_src = 'embed' then
    if public.track_once('entry', p_host, p_ref, p_session, v_ip) then
      update public.hosts set entries = entries + 1, stars = stars + 1 where id = p_host;
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
end $function$;

-- 2) Write Anything posts: 1-500 letters.
create or replace function public.posts_before_write()
returns trigger
language plpgsql
as $function$
begin
  new.body := trim(new.body);
  if length(new.body) < 1 or length(new.body) > 500 then raise exception 'Post must be 1-500 characters'; end if;
  new.created_at := now();
  return new;
end $function$;

-- 3) Community board keeps only each Host page's latest post per guide page.
create or replace function public.board_posts_replace_old()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from public.board_posts where page_key = new.page_key and host_id = new.host_id;
  return new;
end $function$;
revoke all on function public.board_posts_replace_old() from public, anon, authenticated;
drop trigger if exists board_posts_replace_old on public.board_posts;
create trigger board_posts_replace_old before insert on public.board_posts
  for each row execute function public.board_posts_replace_old();

-- 4) Personal guide page gifted to every Host page (and owner-created extra guide pages).
alter table public.static_pages add column if not exists host_id uuid references public.hosts(id) on delete cascade;
alter table public.static_pages add column if not exists active boolean not null default false;
create unique index if not exists static_pages_host_id_key on public.static_pages (host_id) where host_id is not null;

revoke update on public.static_pages from authenticated;
grant update (slug, title, subtitle, body, banner1_url, banner1_link, banner2_url, banner2_link, active, updated_at) on public.static_pages to authenticated;
grant insert, delete on public.static_pages to authenticated;

create policy "host edits own page" on public.static_pages for update to authenticated
  using (host_id is not null and public.owns_host(host_id))
  with check (host_id is not null and public.owns_host(host_id));
create policy "admin creates guide pages" on public.static_pages for insert to authenticated
  with check (public.is_admin() and host_id is null);
create policy "admin deletes guide pages" on public.static_pages for delete to authenticated
  using (public.is_admin() and host_id is null);

create or replace function public.ensure_host_page(p_host uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare h record; v_slug text; v_key text := 'h-' || replace(p_host::text, '-', '');
begin
  select * into h from public.hosts where id = p_host;
  if h.id is null or not public.owns_host(p_host) then return null; end if;
  select slug into v_slug from public.static_pages where host_id = p_host;
  if v_slug is not null then return v_slug; end if;
  v_slug := case when h.is_home then 'hostme-page' else h.slug || '-page' end;
  if exists (select 1 from public.static_pages where slug = v_slug or key = v_slug) or exists (select 1 from public.hosts where slug = v_slug) then
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
  end if;
  insert into public.static_pages (key, slug, title, subtitle, body, host_id, sort)
  values (v_key, v_slug, case when h.is_home then 'Hostme' else h.name end, '', '', p_host, 1000);
  return v_slug;
end $function$;
revoke all on function public.ensure_host_page(uuid) from public, anon;
grant execute on function public.ensure_host_page(uuid) to authenticated, service_role;

-- 5) Owner dashboard counters.
create or replace function public.admin_stats()
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then return null; end if;
  return json_build_object(
    'accounts', (select count(*) from public.accounts),
    'spies', (select count(distinct lower(email)) from public.spies),
    'extra_pages', (select count(*) from public.purchases where kind = 'extra_page' and status = 'paid'),
    'extra_slots', (select count(*) from public.purchases where kind = 'extra_slot' and status = 'paid'),
    'impressions_hosts', (select count(*) from public.purchases where kind = 'impressions_hosts' and status = 'paid'),
    'impressions_hostme', (select count(*) from public.purchases where kind = 'impressions_hostme' and status = 'paid'),
    'gifts', (select count(*) from public.purchases where kind = 'gift_hostme_impressions')
  );
end $function$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated, service_role;