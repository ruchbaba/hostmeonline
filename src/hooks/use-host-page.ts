import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HostPageLink {
  key: string;
  slug: string;
  active: boolean;
}

export const hostPageKey = (hostId: string) => ["host-page", hostId] as const;

/** The free personal guide page that comes with every Host page (null until the owner first opens it). */
export function useHostPage(hostId: string, enabled = true) {
  return useQuery({
    queryKey: hostPageKey(hostId),
    enabled: enabled && !!hostId,
    staleTime: 30_000,
    queryFn: async (): Promise<HostPageLink | null> => {
      const { data } = await supabase.from("static_pages").select("key, slug, active").eq("host_id", hostId).maybeSingle();
      return data ?? null;
    },
  });
}
