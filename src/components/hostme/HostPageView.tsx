import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { qk, trackView, type Host } from "@/lib/api";
import { getPrefs, updatePrefs } from "@/lib/prefs";
import { HostBanner } from "./HostBanner";
import { StatusCard } from "./WriteAnything";
import { TagsRow } from "./TagsRow";
import { GuestGrid } from "./GuestGrid";
import { Invitations } from "./Invitations";
import { FooterSearch } from "./FooterSearch";

export function useLiveHost(initial: Host) {
  return useQuery({
    queryKey: qk.host(initial.slug),
    initialData: initial,
    queryFn: async () => {
      const { data } = await supabase.from("hosts").select("*").eq("id", initial.id).maybeSingle();
      return (data as Host) ?? initial;
    },
    refetchInterval: 20000,
  }).data;
}

/** Counts the view once per page open and makes an owned page the acting page. */
export function useHostVisit(host: Host, ref?: string, src?: string) {
  const { user, isOwnerView } = useMe();
  const owner = isOwnerView(host);
  useEffect(() => {
    trackView(host.id, ref, src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host.id]);
  useEffect(() => {
    if (owner && !getPrefs().lockedHostId) updatePrefs(() => ({ selectedHostId: host.id }));
  }, [owner, host.id, user?.id]);
  return owner;
}

export function HostPageView({ initial, refId, src }: { initial: Host; refId?: string; src?: string }) {
  const host = useLiveHost(initial);
  const isOwner = useHostVisit(host, refId, src);
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-3 py-4">
      <HostBanner host={host} isOwner={isOwner} />
      <StatusCard host={host} isOwner={isOwner} />
      <TagsRow host={host} isOwner={isOwner} />
      <GuestGrid host={host} isOwner={isOwner} pinnedRef={refId} />
      {isOwner && <Invitations host={host} />}
      <FooterSearch contextTags={host.tags} excludeIds={[host.id]} />
    </main>
  );
}
