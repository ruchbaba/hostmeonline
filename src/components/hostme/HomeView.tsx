import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { qk, type Host } from "@/lib/api";
import { compact, usd } from "@/lib/format";
import { OPEN_START_KEY, START_EVENT } from "@/lib/prefs";
import { HostBanner } from "./HostBanner";
import { LiveTicker, StatusCard } from "./WriteAnything";
import { FooterSearch } from "./FooterSearch";
import { StartHostForm } from "./StartHostForm";
import { BuyPageDialog } from "./UserMenu";
import { useHostVisit, useLiveHost } from "./HostPageView";

export const HERO_SLOGAN = "Turn visual space into collective momentum. Share slots, exchange audiences.";

export function StatsTicker() {
  const q = useQuery({
    queryKey: qk.stats,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_global_stats");
      return data as unknown as { entries: number; earnings: number };
    },
    refetchInterval: 10000,
  });
  return (
    <p className="text-center text-xs tracking-wide text-muted-foreground sm:text-sm">
      Total Entry Ports Shared: <b className="tabular-nums text-foreground">{compact(Number(q.data?.entries ?? 0))}</b>
      <span className="mx-2 text-gold">|</span>
      Total Creator Earnings Paid: <b className="tabular-nums text-gold">{usd(Number(q.data?.earnings ?? 0))}</b>
    </p>
  );
}

export function HomeView({ initial, refId, src }: { initial: Host; refId?: string; src?: string }) {
  const host = useLiveHost(initial);
  const isOwner = useHostVisit(host, refId, src);
  const { user } = useMe();
  const [formOpen, setFormOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  useEffect(() => {
    const openForm = () => {
      sessionStorage.removeItem(OPEN_START_KEY);
      setFormOpen(true);
      setTimeout(() => document.getElementById("start-host")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    };
    if (sessionStorage.getItem(OPEN_START_KEY)) openForm();
    window.addEventListener(START_EVENT, openForm);
    return () => window.removeEventListener(START_EVENT, openForm);
  }, []);

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-3 py-4">
      <HostBanner host={host} isOwner={isOwner} />
      {!host.image_url && (
        <h1 className="hm-fade-in text-balance text-center font-display text-2xl font-bold leading-tight sm:text-3xl">{HERO_SLOGAN}</h1>
      )}

      <section id="start-host" className="scroll-mt-20 space-y-3">
        <StatsTicker />
        <div className="flex justify-center">
          <Button variant="gold" size="lg" className="rounded-full px-8" onClick={() => setFormOpen((v) => !v)}>
            <Plus /> Start a Host
          </Button>
        </div>
        {formOpen && <StartHostForm onNeedPurchase={() => setBuyOpen(true)} />}
      </section>

      <section className="space-y-3">
        {/* Owner edits Hostme's own status (text only); visitors see only the rotating live ticker. */}
        {isOwner ? <StatusCard host={host} isOwner /> : <LiveTicker />}
      </section>

      <FooterSearch contextTags={host.tags} excludeIds={[host.id]} />
      {user && <BuyPageDialog open={buyOpen} onClose={() => setBuyOpen(false)} onReady={() => setBuyOpen(false)} />}
    </main>
  );
}
