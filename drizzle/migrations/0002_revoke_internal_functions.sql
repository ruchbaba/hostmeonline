revoke execute on function public.record_purchase(text, uuid, numeric) from public, anon, authenticated;
revoke execute on function public.track_once(text, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.make_slug(text) from public, anon, authenticated;
