import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { qk, type Host } from "@/lib/api";
import { HostCard } from "./Banner";

export function Invitations({ host }: { host: Host }) {
  const qc = useQueryClient();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: qk.invitations(host.id),
    queryFn: async () => {
      const { data } = await supabase.rpc("host_invitations", { p_host: host.id });
      return data ?? [];
    },
    refetchInterval: 30000,
  });
  const list = q.data ?? [];
  if (!list.length) return null;

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.invitations(host.id) }),
      qc.invalidateQueries({ queryKey: qk.guests(host.id) }),
      qc.invalidateQueries({ queryKey: qk.slotStats(host.id) }),
      qc.invalidateQueries({ queryKey: ["relation"] }),
    ]);

  const act = async (fn: "accept_invite" | "decline_invite", id: string) => {
    const { data } = await supabase.rpc(fn, { p_id: id });
    if (data === "full_self") return toast.error("Your guest slots are full. Free one or buy more slots first.");
    if (data === "full_target") return toast.error("Their guest slots are full right now — send them a message.");
    if (data !== "ok") return toast.error("Not possible right now");
    toast.success(fn === "accept_invite" ? "Welcome, new partner!" : "Done");
    await refresh();
  };

  return (
    <section className="space-y-2">
      <div className="grid grid-cols-3 gap-2 opacity-90">
        {list.map((i) => (
          <div key={i.id} className="relative">
            <HostCard slug={i.slug} name={i.name} image={i.image_url} views={i.views} />
            {i.direction === "in" ? (
              <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                <button aria-label="Accept" onClick={() => void act("accept_invite", i.id)} className="press rounded-full bg-success p-1.5 text-background">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button aria-label="Reject" onClick={() => void act("decline_invite", i.id)} className="press rounded-full bg-destructive p-1.5 text-destructive-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                aria-label="Cancel invitation"
                onClick={() => setCancelId(i.id)}
                className="press absolute bottom-1.5 right-1.5 rounded-full bg-overlay p-1 text-overlay-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      <Dialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">Cancel invitation?</DialogTitle>
          </DialogHeader>
          <Button
            variant="destructive"
            onClick={async () => {
              if (cancelId) await act("decline_invite", cancelId);
              setCancelId(null);
            }}
          >
            Cancel invitation
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
