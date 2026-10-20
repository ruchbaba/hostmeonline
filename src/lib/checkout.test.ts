import { describe, expect, it } from "vitest";
import { CHECKOUT_ITEMS, parseCheckoutInput } from "./checkout";

const HOST = "11111111-2222-3333-4444-555555555555";

describe("checkout prices", () => {
  it("extra Host page costs $29.99", () => expect(CHECKOUT_ITEMS.extra_page.amount).toBe(29.99));
  it("extra guest slot costs $9.99", () => expect(CHECKOUT_ITEMS.extra_slot.amount).toBe(9.99));
  it("Sponsor with Hosts is $10 per 10,000", () => expect(CHECKOUT_ITEMS.impressions_hosts.amount).toBe(10));
  it("Sponsor with Hostme is $10 per 10,000", () => expect(CHECKOUT_ITEMS.impressions_hostme.amount).toBe(10));
});

describe("checkout input", () => {
  it("rejects unknown items", () => expect(() => parseCheckoutInput({ kind: "free_stuff" })).toThrow());
  it("guest slots need a host page", () => expect(() => parseCheckoutInput({ kind: "extra_slot" })).toThrow());
  it("impressions need a host page", () => expect(() => parseCheckoutInput({ kind: "impressions_hostme", hostId: "bad" })).toThrow());
  it("extra page ignores any host", () =>
    expect(parseCheckoutInput({ kind: "extra_page", hostId: HOST })).toEqual({ kind: "extra_page", hostId: null }));
  it("keeps a valid host for slots", () =>
    expect(parseCheckoutInput({ kind: "extra_slot", hostId: HOST })).toEqual({ kind: "extra_slot", hostId: HOST }));
});
