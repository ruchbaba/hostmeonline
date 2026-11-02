-- Community board keeps only each account's latest post per guide page (across all of that account's Host pages).
create or replace function public.board_posts_replace_old()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.hosts where id = new.host_id;
  delete from public.board_posts b
  where b.page_key = new.page_key
    and (b.host_id = new.host_id or (v_owner is not null and b.host_id in (select h.id from public.hosts h where h.owner_id = v_owner)));
  return new;
end $function$;
revoke all on function public.board_posts_replace_old() from public, anon, authenticated;