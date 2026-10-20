// Client-safe checkout catalog. Stripe price IDs live in the server functions file.
import { PRICES } from "./slots";

export type CheckoutKind = "extra_page" | "extra_slot" | "impressions_hosts" | "impressions_hostme";

export const CHECKOUT_ITEMS: Record<CheckoutKind, { label: string; amount: number; needsHost: boolean }> = {
  extra_page: { label: "Extra Host page", amount: PRICES.extraPage, needsHost: false },
  extra_slot: { label: "Extra guest slot", amount: PRICES.extraSlot, needsHost: true },
  impressions_hosts: { label: "Sponsor with Hosts · 10,000 impressions", amount: PRICES.impressionPack, needsHost: true },
  impressions_hostme: { label: "Sponsor with Hostme · 10,000 impressions", amount: PRICES.impressionPack, needsHost: true },
};

export function isCheckoutKind(v: unknown): v is CheckoutKind {
  return typeof v === "string" && v in CHECKOUT_ITEMS;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates a checkout request; host-bound items must name a host. */
export function parseCheckoutInput(input: unknown): { kind: CheckoutKind; hostId: string | null } {
  const o = (input ?? {}) as { kind?: unknown; hostId?: unknown };
  if (!isCheckoutKind(o.kind)) throw new Error("Unknown item");
  const hostId = typeof o.hostId === "string" && UUID.test(o.hostId) ? o.hostId : null;
  if (CHECKOUT_ITEMS[o.kind].needsHost && !hostId) throw new Error("Choose a Host page first");
  return { kind: o.kind, hostId: CHECKOUT_ITEMS[o.kind].needsHost ? hostId : null };
}

const PENDING_KEY = "hostme:pending-checkout";
export const markPendingCheckout = () => localStorage.setItem(PENDING_KEY, String(Date.now()));
export const clearPendingCheckout = () => localStorage.removeItem(PENDING_KEY);
export const hasPendingCheckout = () => !!localStorage.getItem(PENDING_KEY);
