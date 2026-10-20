import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createCheckout, syncCheckouts } from "@/lib/checkout.functions";
import { clearPendingCheckout, hasPendingCheckout, markPendingCheckout, type CheckoutKind } from "@/lib/checkout";
import { useMe } from "./use-me";

/** Opens Stripe Checkout in a new tab for one Hostme item. */
export function useCheckout() {
  const create = useServerFn(createCheckout);
  const [busy, setBusy] = useState(false);
  const start = useCallback(
    async (kind: CheckoutKind, hostId?: string | null) => {
      // Open the tab synchronously inside the click so popup blockers allow it.
      const tab = window.open("", "_blank");
      tab?.document.write("<title>Opening secure checkout…</title><body style='background:#14161f;color:#ccc;font-family:sans-serif;display:grid;place-items:center;height:100vh'>Opening secure checkout…</body>");
      setBusy(true);
      try {
        const { url } = await create({ data: { kind, hostId: hostId ?? null } });
        if (!url) throw new Error("Could not start checkout");
        markPendingCheckout();
        if (tab) tab.location.href = url;
        else window.location.href = url;
        return true;
      } catch (e) {
        tab?.close();
        toast.error(e instanceof Error ? e.message : "Could not start checkout");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [create],
  );
  return { start, busy };
}

/** When the user comes back after paying in another tab, apply the purchase and refresh. */
export function CheckoutSync() {
  const { user } = useMe();
  const qc = useQueryClient();
  const sync = useServerFn(syncCheckouts);
  const running = useRef(false);

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      if (running.current || !hasPendingCheckout()) return;
      running.current = true;
      try {
        const { applied, pending } = await sync();
        if (applied > 0) {
          toast.success("Payment received — your purchase is active");
          await qc.invalidateQueries();
        }
        if (pending === 0) clearPendingCheckout();
      } catch {
        // retry on next focus
      } finally {
        running.current = false;
      }
    };
    void run();
    const onFocus = () => void run();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user, sync, qc]);

  return null;
}
