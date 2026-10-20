import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CHECKOUT_ITEMS, parseCheckoutInput, type CheckoutKind } from "./checkout";

const PRICE_IDS: Record<CheckoutKind, string> = {
  extra_page: "price_1USTK77CrMW2DviNkTieyDIY",
  extra_slot: "price_1USTKB7CrMW2DviNv6GoolVO",
  impressions_hosts: "price_1USTKD7CrMW2DviNoqIzruvw",
  impressions_hostme: "price_1USTKD7CrMW2DviNKdvHIG3b",
};

interface StripeSession {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  livemode: boolean;
  client_reference_id: string | null;
}

async function stripe<T>(path: string, init?: { method?: string; body?: URLSearchParams }): Promise<T> {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Payments are not configured");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2025-08-27.basil",
    },
    body: init?.body,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    console.error("Stripe error", res.status, json.error?.message);
    throw new Error("Payment service unavailable, please try again");
  }
  return json;
}

export type CheckoutResult = { status: "ok" | "pending" | "expired"; kind: CheckoutKind; hostSlug: string | null };

/** Checks one session with Stripe and grants the item once when paid. */
async function settle(sessionId: string, userId: string): Promise<CheckoutResult["status"]> {
  const s = await stripe<StripeSession>(`checkout/sessions/${encodeURIComponent(sessionId)}`);
  if (s.client_reference_id !== userId) throw new Error("Not your checkout");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (s.payment_status === "paid") {
    const { error } = await supabaseAdmin.rpc("fulfill_checkout", { p_session: s.id, p_mode: s.livemode ? "live" : "test" });
    if (error) {
      console.error("fulfill_checkout", error.message);
      throw new Error("Payment received but not yet applied — please refresh in a moment");
    }
    return "ok";
  }
  if (s.status === "expired") {
    await supabaseAdmin.from("stripe_checkouts").update({ status: "expired" }).eq("session_id", s.id).eq("status", "pending");
    return "expired";
  }
  return "pending";
}

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseCheckoutInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    if (data.hostId) {
      const { data: owns } = await supabase.rpc("owns_host", { _host: data.hostId });
      if (!owns) throw new Error("You can only buy for your own Host page");
    }
    const origin = new URL(getRequest().url).origin;
    const email = typeof claims.email === "string" ? claims.email : undefined;
    const body = new URLSearchParams({
      mode: "payment",
      "line_items[0][price]": PRICE_IDS[data.kind],
      "line_items[0][quantity]": "1",
      client_reference_id: userId,
      "metadata[kind]": data.kind,
      "metadata[user_id]": userId,
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment-success?canceled=1`,
    });
    if (data.hostId) body.set("metadata[host_id]", data.hostId);
    if (email) body.set("customer_email", email);

    const session = await stripe<StripeSession>("checkout/sessions", { method: "POST", body });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("stripe_checkouts").insert({
      session_id: session.id,
      user_id: userId,
      kind: data.kind,
      host_id: data.hostId,
      amount_usd: CHECKOUT_ITEMS[data.kind].amount,
      mode: session.livemode ? "live" : "test",
    });
    if (error) {
      console.error("stripe_checkouts insert", error.message);
      throw new Error("Could not start checkout");
    }
    return { url: session.url };
  });

export const verifyCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => {
    if (typeof input?.sessionId !== "string" || !/^cs_[A-Za-z0-9_]+$/.test(input.sessionId)) throw new Error("Invalid session");
    return input;
  })
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { data: row } = await context.supabase
      .from("stripe_checkouts")
      .select("session_id, kind, host_id, status")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!row) throw new Error("Checkout not found");
    const status = row.status === "fulfilled" ? "ok" : row.status === "expired" ? "expired" : await settle(row.session_id, context.userId);
    let hostSlug: string | null = null;
    if (row.host_id) {
      const { data: h } = await context.supabase.from("hosts").select("slug").eq("id", row.host_id).maybeSingle();
      hostSlug = h?.slug ?? null;
    }
    return { status, kind: row.kind as CheckoutKind, hostSlug };
  });

/** Applies any paid-but-unapplied checkouts for the signed-in user (e.g. tab closed after paying). */
export const syncCheckouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    const { data: rows } = await context.supabase
      .from("stripe_checkouts")
      .select("session_id")
      .eq("status", "pending")
      .gte("created_at", since)
      .limit(10);
    let applied = 0;
    let pending = 0;
    for (const r of rows ?? []) {
      try {
        const s = await settle(r.session_id, context.userId);
        if (s === "ok") applied++;
        else if (s === "pending") pending++;
      } catch (e) {
        console.error("syncCheckouts", e);
        pending++;
      }
    }
    return { applied, pending };
  });
