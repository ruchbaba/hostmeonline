import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, FilePlus2, Gift, LayoutGrid, Megaphone, Sparkles, UserSearch, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PayoutStatus, type PayoutRow } from "@/components/hostme/PayoutDialog";

export const Route = createFileRoute("/payouts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Payouts — Hostme" },
      { name: "description", content: "Hostme owner payout requests." },
      { property: "og:title", content: "Payout requests — Hostme" },
      { property: "og:description", content: "Hostme owner payout requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PayoutsPage,
});

type Filter = "pending" | "all";

function PayoutsPage() {
  const { me, ready, user } = useMe();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const isAdmin = !!me?.isAdmin;

  const q = useQuery({
    queryKey: ["payouts", "admin", filter],
    enabled: isAdmin,
    queryFn: async () => {
      let req = supabase.from("payout_requests").select("*").order("created_at", { ascending: filter === "pending" }).limit(200);
      if (filter === "pending") req = req.eq("status", "pending");
      const { data } = await req;
      const rows = (data ?? []) as unknown as PayoutRow[];
      const ids = [...new Set(rows.flatMap((r) => Object.keys(r.breakdown ?? {})))];
      const { data: hosts } = ids.length ? await supabase.from("hosts").select("id, name").in("id", ids) : { data: [] };
      const names: Record<string, string> = Object.fromEntries((hosts ?? []).map((h) => [h.id, h.name]));
      return { rows, names };
    },
  });

  const decide = async (id: string, action: "paid" | "reject") => {
    if (action === "reject" && !window.confirm("Reject this payout and put the money back on the host's balance?")) return;
    setBusy(id);
    try {
      const { data, error } = await supabase.rpc("decide_payout", { p_id: id, p_action: action });
      if (error) throw error;
      if (data !== "ok") return toast.error(data === "already_decided" ? "This request was already handled" : "Not allowed");
      toast.success(action === "paid" ? "Marked as paid" : "Rejected — balance restored");
      await qc.invalidateQueries({ queryKey: ["payouts"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(null);
    }
  };

  if (!ready || (user && !me)) return <main className="mx-auto max-w-2xl px-3 py-10" />;
  if (!isAdmin)
    return <main className="mx-auto max-w-2xl px-3 py-10 text-center text-muted-foreground">Only the Hostme owner can see payout requests.</main>;

  const rows = q.data?.rows ?? [];
  const pendingTotal = rows.filter((r) => r.status === "pending").reduce((a, r) => a + Number(r.amount_usd), 0);

  return (
    <main className="mx-auto max-w-2xl space-y-3 px-3 py-4">
      <AdminCounters />
      <h1 className="font-display text-2xl font-bold">Payout requests</h1>
      <p className="text-sm text-muted-foreground">
        Send each amount to the PayPal email in your PayPal account, then tap “Mark paid”. “Reject” puts the money back in the host's balance.
      </p>
      <div className="flex items-center gap-2">
        {(["pending", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("press rounded-full px-3 py-1 text-sm", filter === f ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground")}
          >
            {f === "pending" ? "Pending" : "All"}
          </button>
        ))}
        {filter === "pending" && rows.length > 0 && (
          <span className="ml-auto text-sm text-muted-foreground">
            To send: <span className="font-semibold text-gold tabular-nums">{usd(pendingTotal, 3)}</span>
          </span>
        )}
      </div>
      {q.isSuccess && rows.length === 0 && <p className="text-sm text-muted-foreground">No {filter === "pending" ? "pending " : ""}payout requests.</p>}
      {rows.map((r) => {
        const pages = Object.keys(r.breakdown ?? {}).map((id) => q.data?.names[id] ?? "Deleted page");
        return (
          <div key={r.id} className="space-y-2 rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-xl font-bold tabular-nums text-gold">{usd(Number(r.amount_usd), 3)}</span>
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground" title="Different visitors who earned this money">
                <Users className="h-3.5 w-3.5" /> {r.visitor_count}
              </span>
              <PayoutStatus status={r.status} />
            </div>
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{r.paypal_email}</span>
              <button
                className="press rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                aria-label="Copy PayPal email"
                onClick={() => {
                  void navigator.clipboard.writeText(r.paypal_email);
                  toast.success("PayPal email copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </button>
              <a
                href="https://www.paypal.com/myaccount/transfer/homepage/pay"
                target="_blank"
                rel="noopener noreferrer"
                className="press rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                aria-label="Open PayPal"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              {pages.join(", ")} · {new Date(r.created_at).toLocaleString()}
            </p>
            {r.status === "pending" && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="gold" disabled={busy === r.id} onClick={() => void decide(r.id, "paid")}>
                  <Check /> Mark paid
                </Button>
                <Button variant="outline" disabled={busy === r.id} onClick={() => void decide(r.id, "reject")}>
                  <X /> Reject
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}

interface AdminStats {
  accounts: number;
  spies: number;
  extra_pages: number;
  extra_slots: number;
  impressions_hosts: number;
  impressions_hostme: number;
  gifts: number;
}

/** Owner dashboard counters: accounts, spies and every kind of purchase. */
function AdminCounters() {
  const q = useQuery({
    queryKey: ["admin-stats"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase.rpc("admin_stats");
      return data as unknown as AdminStats | null;
    },
  });
  const s = q.data;
  const items: { label: string; value: number | undefined; icon: React.ReactNode }[] = [
    { label: "Accounts created", value: s?.accounts, icon: <Users /> },
    { label: "People spying", value: s?.spies, icon: <UserSearch /> },
    { label: "Extra pages bought", value: s?.extra_pages, icon: <FilePlus2 /> },
    { label: "Guest slots bought", value: s?.extra_slots, icon: <LayoutGrid /> },
    { label: "Sponsor with Hosts packs", value: s?.impressions_hosts, icon: <Megaphone /> },
    { label: "Sponsor with Hostme packs", value: s?.impressions_hostme, icon: <Sparkles /> },
    { label: "Free Hostme gifts claimed", value: s?.gifts, icon: <Gift /> },
  ];
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="App counters">
      {items.map((i) => (
        <div key={i.label} className="space-y-1 rounded-xl border bg-card p-3">
          <span className="text-gold [&_svg]:h-4 [&_svg]:w-4">{i.icon}</span>
          <p className="font-display text-2xl font-bold tabular-nums">{i.value ?? "—"}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">{i.label}</p>
        </div>
      ))}
    </section>
  );
}
