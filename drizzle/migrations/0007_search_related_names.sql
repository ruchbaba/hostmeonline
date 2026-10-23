CREATE OR REPLACE FUNCTION public.search_hosts(p_q text, p_terms text[], p_min_views integer, p_min_stars integer, p_min_entries integer, p_limit integer, p_offset integer)
RETURNS SETOF public.hosts
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  with q as (
    select
      coalesce(array_remove(regexp_split_to_array(lower(regexp_replace(coalesce(p_q, ''), '[^a-zA-Z0-9[:space:],-]', '', 'g')), '[[:space:],]+'), ''), '{}'::text[]) as exact,
      coalesce(p_terms, '{}'::text[]) as terms
  )
  select h.* from public.hosts h
  cross join q
  cross join lateral (
    select h.tags || array_remove(regexp_split_to_array(lower(h.name), '[^a-z0-9]+'), '') as words
  ) w
  cross join lateral (
    select
      (select count(*) from unnest(w.words) t where t = any(q.exact)) as exact_hits,
      (select count(*) from unnest(w.words) t
        where exists (
          select 1 from unnest(q.exact || q.terms) x
          where t = x
             or (length(x) >= 4 and length(t) >= 4 and (strpos(t, x) > 0 or strpos(x, t) > 0))
             or (length(x) >= 4 and similarity(t, x) >= 0.45)
        )) as related_hits,
      word_similarity(lower(coalesce(p_q, '')), lower(h.name || ' ' || array_to_string(h.tags, ' '))) as name_sim
  ) s
  where not h.is_home and h.image_url <> ''
    and h.views >= coalesce(p_min_views, 0) and h.stars >= coalesce(p_min_stars, 0) and h.entries >= coalesce(p_min_entries, 0)
    and (coalesce(trim(p_q), '') = '' or s.related_hits > 0 or s.name_sim > 0.3)
  order by s.exact_hits desc, s.related_hits desc, s.name_sim desc, h.views desc, h.id
  limit least(coalesce(p_limit, 12), 48) offset coalesce(p_offset, 0)
$function$;