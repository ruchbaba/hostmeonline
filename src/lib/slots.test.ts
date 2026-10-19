import { describe, expect, it } from "vitest";
import {
  buildSlots,
  earningsFromViews,
  feedSlotIsSponsor,
  maxRentable,
  rankGuests,
  slotStats,
  sponsorRowCount,
} from "./slots";

describe("rent rules", () => {
  it("7 guests in 8 slots rent only the 3rd slot", () => {
    expect(maxRentable(7, 8)).toBe(1);
  });
  it("6 guests in 8 slots rent the 3rd and 6th, 8 shown", () => {
    expect(maxRentable(6, 8)).toBe(2);
    const slots = buildSlots([1, 2, 3, 4, 5, 6], 2);
    expect(slots).toHaveLength(8);
    expect(slots.filter((s) => s.kind === "rented").map((s) => s.position)).toEqual([3, 6]);
  });
  it("9 slots allow up to 3 rentals", () => {
    expect(maxRentable(6, 9)).toBe(3);
  });
  it("one guest cannot rent yet", () => {
    expect(maxRentable(1, 8)).toBe(0);
  });
  it("rented slots count toward capacity", () => {
    expect(slotStats(6, 0, true).free).toBe(0);
    expect(slotStats(6, 0, false).free).toBe(2);
  });
  it("3rd guest moves to the 4th position when rent is on", () => {
    const slots = buildSlots(["a", "b", "c", "d", "e", "f", "g"], 1);
    expect(slots[2].kind).toBe("rented");
    expect(slots[3]).toMatchObject({ kind: "guest", guest: "c", position: 4 });
  });
});

describe("guest ranking", () => {
  it("ranks by entries, then slot #1 count, and pins the referrer", () => {
    const g = [
      { id: "a", entries: 1, slot1_count: 0 },
      { id: "b", entries: 5, slot1_count: 0 },
      { id: "c", entries: 1, slot1_count: 9 },
    ];
    expect(rankGuests(g).map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(rankGuests(g, "a").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("sponsor row", () => {
  it("no guests means no sponsor row", () => expect(sponsorRowCount(0, 0)).toBe(0));
  it("odd count adds one sponsor", () => expect(sponsorRowCount(3, 3)).toBe(1));
  it("even count adds two sponsors", () => expect(sponsorRowCount(4, 4)).toBe(2));
});

describe("feed layout", () => {
  it("sponsors take slots 3, 6, 9, 11, 12 of each group; 10 is random", () => {
    const sponsorPositions = Array.from({ length: 12 }, (_, i) => i)
      .filter(feedSlotIsSponsor)
      .map((i) => i + 1);
    expect(sponsorPositions).toEqual([3, 6, 9, 11, 12]);
    expect(feedSlotIsSponsor(14)).toBe(true); // slot 3 of group 2
  });
});

describe("earnings", () => {
  it("pays $1.00 per 1000 views", () => {
    expect(earningsFromViews(1000)).toBe(1);
    expect(earningsFromViews(1)).toBe(0.001);
  });
});
