import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { verifyCheckout, type CheckoutResult } from "@/lib/checkout.functions";
import { CHECKOUT_ITEMS, clearPendingCheckout } from "@/lib/checkout";
import { requestStartHost } from "@/lib/prefs";

export const Route = createFileRoute("/payment-success")({
  validateSearch: (s: Record<string, unknown>) => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
    canceled: s.canceled ? 1 : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Payment · Hostme" },
      { name: "description", content: "Your Hostme purchase status." },
      { property: "og:title", content: "Payment · Hostme" },
      { property: "og:description", content: "Your Hostme purchase status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentPage,
});

type View = { state: "loading" } | { state: "error"; message: string } | { state: "done"; result: CheckoutResult };

function PaymentPage() {
  const { session_id, canceled } = Route.useSearch();
  const { user, ready, refresh } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const verify = useServerFn(verifyCheckout);
  const [view, setView] = useState<View>({ state: "loading" });

  useEffect(() => {
    if (canceled || !session_id || !ready) return;
    if (!user) return setView({ state: "error", message: "Log in with the email you paid with to see this purchase." });
    let alive = true;
    let tries = 0;
    const check = async () => {
      try {
        const result = await verify({ data: { sessionId: session_id } });
        if (!alive) return;
        if (result.status === "pending" && tries++ < 5) return void setTimeout(check, 2000);
        setView({ state: "done", result });
        if (result.status === "ok") {
          clearPendingCheckout();
          await qc.invalidateQueries();
          refresh();
        }
      } catch (e) {
        if (alive) setView({ state: "error", message: e instanceof Error ? e.message : "Could not check payment" });
      }
    };
    void check();
    return () => {
      alive = false;
    };
  }, [session_id, canceled, ready, user, verify, qc, refresh]);

  const box = "mx-auto mt-16 max-w-md space-y-4 rounded-2xl border bg-card p-6 text-center";

  if (canceled || !session_id) {
    return (
      <main className={box}>
        <XCircle className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="font-display text-xl font-bold">Checkout canceled</h1>
        <p className="text-sm text-muted-foreground">No payment was taken. You can close this tab or go back to Hostme.</p>
        <Button asChild variant="outline">
          <Link to="/">Back to Hostme</Link>
        </Button>
      </main>
    );
  }
  if (view.state === "loading") {
    return (
      <main className={box}>
        <Clock className="mx-auto h-10 w-10 animate-pulse text-gold" />
        <p className="text-sm text-muted-foreground">Confirming your payment…</p>
      </main>
    );
  }
  if (view.state === "error") {
    return (
      <main className={box}>
        <XCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="text-sm">{view.message}</p>
        <Button asChild variant="outline">
          <Link to="/">Back to Hostme</Link>
        </Button>
      </main>
    );
  }
  const { result } = view;
  const item = CHECKOUT_ITEMS[result.kind];
  if (result.status !== "ok") {
    return (
      <main className={box}>
        <Clock className="mx-auto h-10 w-10 text-gold" />
        <h1 className="font-display text-xl font-bold">{result.status === "expired" ? "Checkout expired" : "Payment still processing"}</h1>
        <p className="text-sm text-muted-foreground">
          {result.status === "expired"
            ? "This checkout timed out and nothing was charged."
            : "We'll apply your purchase automatically as soon as Stripe confirms it."}
        </p>
        <Button asChild variant="outline">
          <Link to="/">Back to Hostme</Link>
        </Button>
      </main>
    );
  }
  return (
    <main className={box}>
      <CheckCircle2 className="mx-auto h-10 w-10 text-gold" />
      <h1 className="font-display text-xl font-bold">Payment received</h1>
      <p className="text-sm text-muted-foreground">{item.label} is now active on your account.</p>
      {result.kind === "extra_page" ? (
        <Button
          variant="gold"
          onClick={() => {
            requestStartHost();
            void navigate({ to: "/" });
          }}
        >
          <Plus /> Start your new Host
        </Button>
      ) : result.hostSlug ? (
        <Button asChild variant="gold">
          <Link to="/$slug" params={{ slug: result.hostSlug }}>
            Go to my Host page
          </Link>
        </Button>
      ) : (
        <Button asChild variant="gold">
          <Link to="/">Back to Hostme</Link>
        </Button>
      )}
    </main>
  );
}
