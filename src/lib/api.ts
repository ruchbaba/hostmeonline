// Browser-side data helpers (RLS applies). Import only from components/hooks.
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getSessionKey } from "./prefs";

export type Host = Tables<"hosts">;
export type Post = Tables<"posts">;
export type Campaign = Tables<"ad_campaigns">;

export interface GuestHost {
  id: string;
  slug: string;
  name: string;
  image_url: string;
  views: number;
  tags: string[];
  entries: number;
  slot1_count: number;
}

export interface SponsorPick {
  campaign_id: string;
  host_id: string;
  slug: string;
  name: string;
  image_url: string;
  views: number;
  tags: string[];
}

export interface SlotStats {
  guests: number;
  capacity: number;
  rented: number;
  free: number;
  rent_enabled: boolean;
  max_rentable: number;
}

export const qk = {
  host: (slug: string) => ["host", slug] as const,
  home: ["home-host"] as const,
  guests: (id: string) => ["guests", id] as const,
  slotStats: (id: string) => ["slot-stats", id] as const,
  invitations: (id: string) => ["invitations", id] as const,
  relation: (from: string, to: string) => ["relation", from, to] as const,
  post: (id: string) => ["post", id] as const,
  posts: ["posts"] as const,
  stats: ["global-stats"] as const,
  me: (uid: string | null) => ["me", uid] as const,
  unread: (uid: string | null) => ["unread", uid] as const,
  campaigns: (uid: string | null) => ["campaigns", uid] as const,
  gift: (uid: string | null) => ["gift", uid] as const,
};

export async function fetchGuests(hostId: string): Promise<GuestHost[]> {
  const { data, error } = await supabase.rpc("host_guests", { p_host: hostId });
  if (error) throw error;
  return (data ?? []) as GuestHost[];
}

export async function fetchSlotStats(hostId: string): Promise<SlotStats | null> {
  const { data, error } = await supabase.rpc("host_slot_stats", { p_host: hostId });
  if (error) throw error;
  return (data as unknown as SlotStats) ?? null;
}

export async function pickSponsors(kind: "hosts" | "hostme", tags: string[], exclude: string[], limit: number) {
  if (limit <= 0) return [] as SponsorPick[];
  const { data, error } = await supabase.rpc("pick_sponsors", {
    p_kind: kind,
    p_tags: tags,
    p_exclude: exclude,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as SponsorPick[];
}

export async function uploadBanner(blob: Blob, folder: string): Promise<string> {
  const path = `${folder}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("banners").upload(path, blob, {
    contentType: "image/webp",
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw error;

  const { data } = supabase.storage.from("banners").getPublicUrl(path);
  return data.publicUrl;
}

/** Sends a query now. Supabase query builders are lazy: without await/then no request is made. */
export async function fire(q: PromiseLike<unknown>): Promise<void> {
  try {
    await q;
  } catch {
    /* tracking is best-effort */
  }
}

export function trackView(hostId: string, ref?: string | null, src?: string | null): Promise<void> {
  const s = getSessionKey();
  if (!s) return Promise.resolve();
  return fire(supabase.rpc("track_view", { p_host: hostId, p_session: s, p_ref: ref ?? undefined, p_src: src ?? undefined }));
}

export function trackImpression(campaignId: string, servedOnHost: string | null, context: "inapp" | "shared") {
  const s = getSessionKey();
  if (!s) return;
  void fire(
    supabase.rpc("track_impression", {
      p_campaign: campaignId,
      p_host: (servedOnHost ?? null) as unknown as string,
      p_context: context,
      p_session: s,
    }),
  );
}

export function trackSharedImpression(hostId: string) {
  const s = getSessionKey();
  if (!s) return;
  void fire(supabase.rpc("track_shared_impression", { p_host: hostId, p_session: s }));
}

export async function sendOtp(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth`, shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function emailStatus(email: string): Promise<"host" | "none"> {
  const { data } = await supabase.rpc("email_status", { p_email: email });
  return data === "host" ? "host" : "none";
}
