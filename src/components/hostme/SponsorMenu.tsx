import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Coins, DoorOpen, Wallet, Gift, Sparkles, Star, Store, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { useCheckout } from "@/hooks/use-checkout";
import { fetchSlotStats, qk, type Campaign } from "@/lib/api";
import { compact, usd } from "@/lib/format";
import { PRICES } from "@/lib/slots";
import { TickingMoney } from "./TickingMoney";
import { PayoutDialog } from "./PayoutDialog";

type Panel = "rent" | "hosts" | "hostme" | "payout" | null;

export function TestModeNote() {
  return (
    <p className="text-center text-[11px] text-muted-foreground">
      Secure card payment by Stripe opens in a new tab. Your purchase activates as soon as it's paid.
    </p>
  );
}

export function SponsorMenu() {
  const { user, acting, totalBalance } = useMe();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  if (!user || !acting) return <span className="h-9 w-9" />;
  const go = (p: Panel) => {
    setOpen(false);
    setPanel(p);
  };
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="press inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-gold hover:bg-gold-soft" aria-label="Sponsor">
            <Coins className="h-5 w-5" />
            {totalBalance > 0 && <TickingMoney value={totalBalance} className="text-sm font-semibold tabular-nums" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1.5">
          <button
            onClick={() => go("payout")}
            className="press mb-1 flex w-full items-center gap-3 rounded-md bg-gold-soft px-3 py-2.5 text-left hover:bg-gold-soft/80"
            aria-label="My earnings and payouts"
          >
            <Wallet className="h-4 w-4 text-gold" />
            <TickingMoney value={totalBalance} className="font-semibold tabular-nums text-gold" />
            <span className="ml-auto inline-flex items-center text-xs text-muted-foreground">
              Payout <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </button>
          <MenuItem icon={<Store />} label="Rent Out My Slots" onClick={() => go("rent")} />
          <MenuItem icon={<Users />} label="Sponsor with Hosts" onClick={() => go("hosts")} />
          <MenuItem icon={<Sparkles />} label="Sponsor with Hostme" onClick={() => go("hostme")} />
        </PopoverContent>
      </Popover>
      <PayoutDialog open={panel === "payout"} onClose={() => setPanel(null)} />
      <RentDialog open={panel === "rent"} onClose={() => setPanel(null)} />
      <SponsorDialog kind="hosts" open={panel === "hosts"} onClose={() => setPanel(null)} />
      <SponsorDialog kind="hostme" open={panel === "hostme"} onClose={() => setPanel(null)} />
    </>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="press flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-gold"
    >
      {icon}
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function RentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { acting, me } = useMe();
  const qc = useQueryClient();
  const stats = useQuery({
    queryKey: qk.slotStats(acting?.id ?? ""),
    queryFn: () => fetchSlotStats(acting!.id),
    enabled: open && !!acting,
  });
  const s = stats.data;
  const balance = acting ? (me?.balances[acting.id] ?? 0) : 0;
  const toggle = async (on: boolean) => {
    if (!acting) return;
    const { error } = await supabase.from("hosts").update({ rent_enabled: on }).eq("id", acting.id);
    if (error) return toast.error(error.message);
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.slotStats(acting.id) }),
      qc.invalidateQueries({ queryKey: qk.guests(acting.id) }),
      qc.invalidateQueries({ queryKey: ["host"] }),
      qc.invalidateQueries({ queryKey: qk.home }),
      qc.invalidateQueries({ queryKey: ["me"] }),
    ]);
    toast.success(on ? "Rent activated" : "Rent paused");
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Rent Out My Slots</DialogTitle>
          <DialogDescription>
            Every 3rd guest slot (3, 6, 9…) can show paid “Sponsor with Hosts” banners as your guests fill up. You earn{" "}
            {usd(0.001, 3)} per view ({usd(1)} CPM) — 100% goes to you.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          For <span className="text-foreground">{acting?.name}</span>
        </p>
        {s && (
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Active guests" value={s.guests} />
            <Stat label="Slots" value={s.capacity} />
            <Stat label="Free" value={s.free} />
            <Stat label="Rentable" value={s.max_rentable} />
            <Stat label="Rented" value={s.rented} />
            <Stat label="Earned" value={<TickingMoney value={balance} />} />
          </div>
        )}
        {s && s.max_rentable === 0 && !s.rent_enabled && (
          <p className="rounded-lg bg-gold-soft p-3 text-sm">
            {s.free === 0
              ? "Your guest slots are full. Free up a slot or buy more slots to unlock rentals."
              : "Rentals unlock as guests fill up: the 3rd slot opens with 2 guests, the 6th with 4, and so on."}
          </p>
        )}
        <label className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm font-medium">
            {s?.rent_enabled ? `${s.rented} slot${s.rented === 1 ? "" : "s"} renting` : "Activate rent"}
          </span>
          <Switch checked={!!s?.rent_enabled} onCheckedChange={(v) => void toggle(v)} disabled={!s} />
        </label>
      </DialogContent>
    </Dialog>
  );
}

function SponsorDialog({ kind, open, onClose }: { kind: "hosts" | "hostme"; open: boolean; onClose: () => void }) {
  const { acting, user, me, refresh } = useMe();
  const qc = useQueryClient();
  const checkout = useCheckout();
  const [rpcBusy, setBusy] = useState(false);
  const busy = rpcBusy || checkout.busy;
  const campaigns = useQuery({
    queryKey: qk.campaigns(user?.id ?? null),
    enabled: open && !!user,
    queryFn: async () => {
      const { data } = await supabase.from("ad_campaigns").select("*").eq("owner_id", user!.id);
      return (data ?? []) as Campaign[];
    },
  });
  const gift = useQuery({
    queryKey: qk.gift(user?.id ?? null),
    enabled: open && kind === "hostme" && !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("gift_status");
      return data as unknown as { remaining: number; claimed: boolean };
    },
  });
  const mine = (campaigns.data ?? []).filter((c) => c.kind === kind);
  const current = mine.find((c) => c.host_id === acting?.id);
  const giftAvailable = kind === "hostme" && gift.data && !gift.data.claimed && gift.data.remaining > 0;
  const free = me?.isAdmin;

  const act = async (fn: "buy" | "gift") => {
    if (!acting) return;
    if (fn === "buy" && !free) {
      if (await checkout.start(kind === "hosts" ? "impressions_hosts" : "impressions_hostme", acting.id)) onClose();
      return;
    }
    setBusy(true);
    try {
      const { data, error } =
        fn === "gift"
          ? await supabase.rpc("claim_gift", { p_host: acting.id })
          : await supabase.rpc("buy_impressions", { p_host: acting.id, p_kind: kind });
      if (error || data !== "ok") throw new Error(error?.message || (data === "over" ? "The gift is no longer available" : "Could not complete"));
      toast.success(fn === "gift" ? "Gift activated: 10,000 impressions" : "10,000 impressions added");
      await qc.invalidateQueries({ queryKey: qk.campaigns(user?.id ?? null) });
      await qc.invalidateQueries({ queryKey: qk.gift(user?.id ?? null) });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">{kind === "hosts" ? "Sponsor with Hosts" : "Sponsor with Hostme"}</DialogTitle>
          <DialogDescription>
            {kind === "hosts"
              ? "Your banner rotates through rented 3rd slots on partner Host pages whose tags match yours. 100% of every impression ($1.00 CPM) goes straight to the hosting creator."
              : "Premium placement in the bottom slots of Hostme pages and inside search suggestions. Hostme keeps this revenue to run the network."}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Banner and tags from <span className="text-foreground">{acting?.name}</span>
        </p>
        <div className={`grid gap-2 ${kind === "hosts" ? "grid-cols-3" : "grid-cols-2"}`}>
          <Stat label="Remaining" value={compact(current?.remaining_impressions ?? 0)} />
          <Stat
            label="In Hostme"
            value={
              <span className="inline-flex items-center gap-1">
                <Star className="h-4 w-4 text-gold" />
                {compact(current?.inapp_impressions ?? 0)}
              </span>
            }
          />
          {kind === "hosts" && (
            <Stat
              label="Shared"
              value={
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-4 w-4 text-suggest" />
                  {compact(current?.shared_impressions ?? 0)}
                </span>
              }
            />
          )}
        </div>
        {mine.length > 1 && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {mine
              .filter((c) => c.host_id !== acting?.id)
              .map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span>{me?.hosts.find((h) => h.id === c.host_id)?.name ?? "Other page"}</span>
                  <span className="tabular-nums">{compact(c.remaining_impressions)} left</span>
                </li>
              ))}
          </ul>
        )}
        {giftAvailable ? (
          <Button variant="gold" disabled={busy} onClick={() => void act("gift")}>
            <Gift /> Activate my free 10,000 impressions
          </Button>
        ) : (
          <Button variant="gold" disabled={busy} onClick={() => void act("buy")}>
            <DoorOpen /> {free ? "Add 10,000 impressions" : `${usd(PRICES.impressionPack)} for 10,000 impressions`}
          </Button>
        )}
        {giftAvailable && (
          <p className="text-center text-xs text-muted-foreground">Gift for the first 5,000 Hosts · {compact(gift.data!.remaining)} left</p>
        )}
        {!free && <TestModeNote />}
      </DialogContent>
    </Dialog>
  );
}
