CREATE OR REPLACE FUNCTION public.host_in_range(p_host uuid, p_scope text, p_lat double precision, p_lng double precision, p_city text, p_region text, p_country text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.host_locations l
    WHERE l.host_id = p_host AND CASE
      WHEN p_scope IN ('5', '10', '20', '50', '100') THEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND
        2 * 6371 * asin(least(1, sqrt(
          power(sin(radians(l.lat - p_lat) / 2), 2) +
          cos(radians(p_lat)) * cos(radians(l.lat)) * power(sin(radians(l.lng - p_lng) / 2), 2)
        ))) <= p_scope::int
      WHEN p_scope = 'city' THEN coalesce(p_city, '') <> '' AND lower(l.city) = lower(p_city) AND lower(l.country) = lower(coalesce(p_country, ''))
      WHEN p_scope IN ('state', 'province') THEN coalesce(p_region, '') <> '' AND lower(l.region) = lower(p_region) AND lower(l.country) = lower(coalesce(p_country, ''))
      WHEN p_scope = 'country' THEN coalesce(p_country, '') <> '' AND lower(l.country) = lower(p_country)
      ELSE true
    END
  )
$$;