import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Store, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { useCheckout } from "@/hooks/use-checkout";
import { fetchGuests, fetchSlotStats, pickSponsors, qk, trackImpression, type Host, type SponsorPick } from "@/lib/api";
import { PRICES, buildSlots, rankGuests, slotStats, sponsorRowCount } from "@/lib/slots";
import { usd } from "@/lib/format";
import { requestSearch } from "@/lib/prefs";
import { HostCard } from "./Banner";
import { TestModeNote } from "./SponsorMenu";

interface FillCard {
  key: string;
  hostId: string;
  slug: string;
  name: string;
  image: string;
  views: number;
  campaignId?: string;
}

async function randomFill(exclude: string[], n: number): Promise<FillCard[]> {
  if (n <= 0) return [];
  const { data } = await supabase.rpc("discover_hosts", {
    p_seed: String(Math.random()),
    p_min_views: 0,
    p_min_stars: 0,
    p_min_entries: 0,
    p_limit: n + exclude.length,
    p_offset: 0,
  });
  return (data ?? [])
    .filter((h) => !exclude.includes(h.id))
    .slice(0, n)
    .map((h) => ({ key: `r-${h.id}`, hostId: h.id, slug: h.slug, name: h.name, image: h.image_url, views: h.views }));
}

function toCard(s: SponsorPick): FillCard {
  return { key: `c-${s.campaign_id}`, hostId: s.host_id, slug: s.slug, name: s.name, image: s.image_url, views: s.views, campaignId: s.campaign_id };
}

export function GuestGrid({ host, isOwner, pinnedRef }: { host: Host; isOwner: boolean; pinnedRef?: string | null }) {
  const [buyOpen, setBuyOpen] = useState(false);
  const guestsQ = useQuery({ queryKey: qk.guests(host.id), queryFn: () => fetchGuests(host.id) });
  const statsQ = useQuery({ queryKey: [...qk.slotStats(host.id), guestsQ.data?.length ?? 0], queryFn: () => fetchSlotStats(host.id) });
  const guests = guestsQ.data ?? [];
  const stats = statsQ.data ?? slotStats(guests.length, host.extra_slots, host.rent_enabled);
  const ranked = useMemo(() => rankGuests(guests, pinnedRef), [guests, pinnedRef]);
  const slots = useMemo(() => buildSlots(ranked, stats.rented), [ranked, stats.rented]);
  const exclude = useMemo(() => [host.id, ...guests.map((g) => g.id)], [host.id, guests]);
  const sponsorRow = isOwner ? 0 : sponsorRowCount(slots.length, guests.length);

  const fillQ = useQuery({
    queryKey: ["grid-fill", host.id, isOwner, stats.rented, sponsorRow, exclude.join(",")],
    enabled: guestsQ.isSuccess && (stats.rented > 0 || sponsorRow > 0),
    staleTime: 60_000,
    queryFn: async () => {
      const rentAds = (await pickSponsors("hosts", host.tags, exclude, stats.rented)).map(toCard);
      // Owner preview: only the paying sponsors renting the slots, no random filler.
      if (isOwner) return { rent: rentAds, bottom: [] as FillCard[] };
      const hostme = (await pickSponsors("hostme", host.tags, exclude, sponsorRow)).map(toCard);
      const ex2 = [...exclude, ...rentAds.map((c) => c.hostId), ...hostme.map((c) => c.hostId)];
      const missing = stats.rented - rentAds.length + (sponsorRow - hostme.length);
      const random = await randomFill(ex2, missing);
      const rent = [...rentAds, ...random.splice(0, stats.rented - rentAds.length)];
      return { rent, bottom: [...hostme, ...random] };
    },
  });

  if (!guestsQ.isSuccess) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="aspect-[16/9] animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  const rentCards = fillQ.data?.rent ?? [];
  const bottom = fillQ.data?.bottom ?? [];

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {slots.map((s) => {
          if (s.kind === "guest") {
            return <HostCard key={s.guest.id} slug={s.guest.slug} name={s.guest.name} image={s.guest.image_url} views={s.guest.views} refId={host.id} />;
          }
          const c = rentCards[s.rentIndex];
          if (isOwner) {
            if (c) {
              return (
                <HostCard key={c.key} slug={c.slug} name={c.name} image={c.image} views={c.views} className="ring-1 ring-gold/50">
                  <span
                    title="Rented slot"
                    className="pointer-events-none absolute right-2 top-2 inline-flex items-center rounded-full bg-gold-gradient p-1 text-gold-foreground shadow-gold"
                  >
                    <Store className="h-3.5 w-3.5" />
                  </span>
                </HostCard>
              );
            }
            return (
              <div
                key={`rent-${s.position}`}
                title="Rented slot — waiting for a sponsor"
                className="flex aspect-[16/9] items-center justify-center rounded-xl border-2 border-dashed border-gold/50 bg-gold-soft text-gold"
              >
                <Store className="h-7 w-7" />
              </div>
            );
          }
          if (!c) return <div key={`rent-${s.position}`} className="aspect-[16/9] animate-pulse rounded-xl bg-muted" />;
          return (
            <HostCard
              key={c.key}
              slug={c.slug}
              name={c.name}
              image={c.image}
              views={c.views}
              onImpression={c.campaignId ? () => trackImpression(c.campaignId!, host.id, "inapp") : null}
              impressionKey={c.key}
            />
          );
        })}
        {isOwner && guests.length === 0 && (
          <button
            onClick={requestSearch}
            className="press flex aspect-[16/9] items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-gold/40 hover:text-gold"
            aria-label="Find guests"
          >
            <UserPlus className="h-7 w-7" />
          </button>
        )}
        {isOwner && (
          <button
            onClick={() => (stats.free > 0 ? requestSearch() : setBuyOpen(true))}
            className="press flex aspect-[16/9] items-center justify-center rounded-xl border-2 border-dashed border-gold/40 text-gold hover:bg-gold-soft"
            aria-label={stats.free > 0 ? "Invite guests" : "Buy additional guest slot"}
          >
            <Plus className="h-8 w-8" />
          </button>
        )}
        {bottom.slice(0, sponsorRow).map((c) => (
          <HostCard
            key={c.key}
            slug={c.slug}
            name={c.name}
            image={c.image}
            views={c.views}
            onImpression={c.campaignId ? () => trackImpression(c.campaignId!, null, "inapp") : null}
            impressionKey={c.key}
          />
        ))}
      </div>
      {isOwner && <BuySlotDialog host={host} open={buyOpen} onClose={() => setBuyOpen(false)} />}
    </>
  );
}

function BuySlotDialog({ host, open, onClose }: { host: Host; open: boolean; onClose: () => void }) {
  const { me, refresh } = useMe();
  const qc = useQueryClient();
  const checkout = useCheckout();
  const [rpcBusy, setBusy] = useState(false);
  const busy = rpcBusy || checkout.busy;
  const free = me?.isAdmin;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Buy Additional Guest Slot</DialogTitle>
          <DialogDescription>
            Your guest slots are full. Each extra slot is {usd(PRICES.extraSlot)} and adds one more place to your grid — every 3rd slot also joins the rental stream.
          </DialogDescription>
        </DialogHeader>
        <Button
          variant="gold"
          disabled={busy}
          onClick={async () => {
            if (!free) {
              if (await checkout.start("extra_slot", host.id)) onClose();
              return;
            }
            setBusy(true);
            const { data, error } = await supabase.rpc("buy_extra_slot", { p_host: host.id });
            setBusy(false);
            if (error || data !== "ok") return toast.error("Could not complete");
            toast.success("New guest slot unlocked");
            await qc.invalidateQueries({ queryKey: ["host"] });
            await qc.invalidateQueries({ queryKey: qk.home });
            await qc.invalidateQueries({ queryKey: qk.slotStats(host.id) });
            refresh();
            onClose();
          }}
        >
          <Plus /> {free ? "Add a slot" : `Buy for ${usd(PRICES.extraSlot)}`}
        </Button>
        {!free && <TestModeNote />}
      </DialogContent>
    </Dialog>
  );
}
