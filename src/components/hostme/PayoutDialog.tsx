import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { usd } from "@/lib/format";
import { TickingMoney } from "./TickingMoney";

export type PayoutRow = {
  id: string;
  user_id: string;
  paypal_email: string;
  amount_usd: number;
  breakdown: Record<string, number>;
  status: "pending" | "paid" | "rejected";
  created_at: string;
  decided_at: string | null;
};

const ERRORS: Record<string, string> = {
  invalid_email: "Enter a valid PayPal email",
  no_balance: "You have no earnings to pay out yet",
  login_required: "Log in first",
};

export function PayoutStatus({ status }: { status: PayoutRow["status"] }) {
  if (status === "paid")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold">
        <CheckCircle2 className="h-3.5 w-3.5" /> Paid
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
        <XCircle className="h-3.5 w-3.5" /> Rejected
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
      <Clock className="h-3.5 w-3.5" /> Pending
    </span>
  );
}

export function PayoutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, totalBalance, refresh } = useMe();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = useQuery({
    queryKey: ["payouts", "mine", user?.id ?? null],
    enabled: open && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []) as unknown as PayoutRow[];
    },
  });
  const last = mine.data?.[0]?.paypal_email;
  useEffect(() => {
    if (last && !email) setEmail(last);
  }, [last, email]);

  const submit = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("request_payout", { p_email: email });
      if (error) throw error;
      if (data !== "ok") return toast.error(ERRORS[data as string] ?? "Could not request payout");
      toast.success("Payout requested. You'll receive it on PayPal.");
      refresh();
      await qc.invalidateQueries({ queryKey: ["payouts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not request payout");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">My earnings</DialogTitle>
          <DialogDescription>
            Request a payout to your PayPal. Your whole balance moves into the request and is sent to you by Hostme.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-gold-soft p-4 text-center">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Available</div>
          <TickingMoney value={totalBalance} className="font-display text-3xl font-bold tabular-nums text-gold" />
        </div>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Input type="email" placeholder="PayPal email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" variant="gold" className="w-full" disabled={busy || totalBalance <= 0}>
            <Send /> {totalBalance > 0 ? `Request ${usd(totalBalance, 3)} payout` : "No earnings yet"}
          </Button>
        </form>
        {(mine.data?.length ?? 0) > 0 && (
          <div className="space-y-1">
            <p className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground">My payouts</p>
            {mine.data!.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                <span className="tabular-nums">{usd(Number(p.amount_usd), 3)}</span>
                <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                <PayoutStatus status={p.status} />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
