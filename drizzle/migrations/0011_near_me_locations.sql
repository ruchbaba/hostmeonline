CREATE TABLE public.host_locations (
  host_id uuid PRIMARY KEY REFERENCES public.hosts(id) ON DELETE CASCADE,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  city text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.host_locations TO authenticated;
GRANT ALL ON public.host_locations TO service_role;
ALTER TABLE public.host_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read own location" ON public.host_locations FOR SELECT TO authenticated USING (public.owns_host(host_id));

-- Owner shares an approximate (about 1 km) position so near-me searches can find the page.
CREATE OR REPLACE FUNCTION public.set_host_location(p_host uuid, p_lat double precision, p_lng double precision, p_city text, p_region text, p_country text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owns_host(p_host) THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'bad_position'; END IF;
  INSERT INTO public.host_locations (host_id, lat, lng, city, region, country, updated_at)
  VALUES (p_host, round(p_lat::numeric, 2)::double precision, round(p_lng::numeric, 2)::double precision,
          left(coalesce(trim(p_city), ''), 80), left(coalesce(trim(p_region), ''), 80), left(coalesce(trim(p_country), ''), 80), now())
  ON CONFLICT (host_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, city = excluded.city, region = excluded.region, country = excluded.country, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.clear_host_location(p_host uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owns_host(p_host) THEN RAISE EXCEPTION 'not_owner'; END IF;
  DELETE FROM public.host_locations WHERE host_id = p_host;
END $$;

-- True when a host shared its place and it falls inside the searcher's chosen range.
-- p_scope: '5' | '10' | '100' (km) | 'city' | 'state' | 'country'.
CREATE OR REPLACE FUNCTION public.host_in_range(p_host uuid, p_scope text, p_lat double precision, p_lng double precision, p_city text, p_region text, p_country text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.host_locations l
    WHERE l.host_id = p_host AND CASE
      WHEN p_scope IN ('5', '10', '100') THEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND
        2 * 6371 * asin(least(1, sqrt(
          power(sin(radians(l.lat - p_lat) / 2), 2) +
          cos(radians(p_lat)) * cos(radians(l.lat)) * power(sin(radians(l.lng - p_lng) / 2), 2)
        ))) <= p_scope::int
      WHEN p_scope = 'city' THEN coalesce(p_city, '') <> '' AND lower(l.city) = lower(p_city) AND lower(l.country) = lower(coalesce(p_country, ''))
      WHEN p_scope = 'state' THEN coalesce(p_region, '') <> '' AND lower(l.region) = lower(p_region) AND lower(l.country) = lower(coalesce(p_country, ''))
      WHEN p_scope = 'country' THEN coalesce(p_country, '') <> '' AND lower(l.country) = lower(p_country)
      ELSE true
    END
  )
$$;

CREATE OR REPLACE FUNCTION public.search_hosts_near(p_q text, p_terms text[], p_min_views integer, p_min_stars integer, p_min_entries integer, p_limit integer, p_offset integer,
  p_scope text, p_lat double precision, p_lng double precision, p_city text, p_region text, p_country text)
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
    and public.host_in_range(h.id, p_scope, p_lat, p_lng, p_city, p_region, p_country)
  order by s.exact_hits desc, s.related_hits desc, s.name_sim desc, h.views desc, h.id
  limit least(coalesce(p_limit, 12), 48) offset coalesce(p_offset, 0)
$function$;

CREATE OR REPLACE FUNCTION public.discover_hosts_near(p_seed text, p_min_views int, p_min_stars int, p_min_entries int, p_limit int, p_offset int,
  p_scope text, p_lat double precision, p_lng double precision, p_city text, p_region text, p_country text)
RETURNS SETOF public.hosts LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select h.* from public.hosts h
  where not h.is_home and h.image_url <> ''
    and h.views >= coalesce(p_min_views, 0) and h.stars >= coalesce(p_min_stars, 0) and h.entries >= coalesce(p_min_entries, 0)
    and public.host_in_range(h.id, p_scope, p_lat, p_lng, p_city, p_region, p_country)
  order by md5(h.id::text || coalesce(p_seed, ''))
  limit least(coalesce(p_limit, 12), 48) offset coalesce(p_offset, 0)
$$;

REVOKE ALL ON FUNCTION public.set_host_location(uuid, double precision, double precision, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_host_location(uuid, double precision, double precision, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.clear_host_location(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clear_host_location(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.host_in_range(uuid, text, double precision, double precision, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_hosts_near(text, text[], integer, integer, integer, integer, integer, text, double precision, double precision, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_hosts_near(text, integer, integer, integer, integer, integer, text, double precision, double precision, text, text, text) TO anon, authenticated;