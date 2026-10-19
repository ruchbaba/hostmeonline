// Pure slot/grid rules for Hostme. Kept framework-free so they can be unit tested.

export const BASE_GUEST_SLOTS = 8;
export const MAX_TAGS = 13;
export const HOST_CPM_USD = 1;
export const PER_VIEW_USD = HOST_CPM_USD / 1000;
export const IMPRESSION_PACK = 10000;
export const PRICES = {
  extraPage: 29.99,
  extraSlot: 9.99,
  impressionPack: 10,
} as const;

export interface GuestLike {
  id: string;
  entries: number;
  slot1_count: number;
}

/** Every 3rd slot can be rented as long as guests + rented fit inside capacity. */
export function maxRentable(guests: number, capacity: number): number {
  return Math.max(0, Math.min(Math.floor(guests / 2), capacity - guests));
}

export function slotStats(guests: number, extraSlots: number, rentEnabled: boolean) {
  const capacity = BASE_GUEST_SLOTS + extraSlots;
  const rentable = maxRentable(guests, capacity);
  const rented = rentEnabled ? rentable : 0;
  return { guests, capacity, rentable, rented, free: capacity - guests - rented };
}

/** Rank by entry ports provided, then by times in slot #1; optionally pin a referrer first. */
export function rankGuests<T extends GuestLike>(guests: T[], pinnedId?: string | null): T[] {
  const sorted = [...guests].sort(
    (a, b) => b.entries - a.entries || b.slot1_count - a.slot1_count,
  );
  if (!pinnedId) return sorted;
  const i = sorted.findIndex((g) => g.id === pinnedId);
  if (i <= 0) return sorted;
  const [pinned] = sorted.splice(i, 1);
  return [pinned, ...sorted];
}

export type Slot<T> = { kind: "guest"; guest: T; position: number } | { kind: "rented"; position: number; rentIndex: number };

/** Positions 3, 6, 9… become rented slots (up to `rented`); guests flow around them. */
export function buildSlots<T>(rankedGuests: T[], rented: number): Slot<T>[] {
  const total = rankedGuests.length + rented;
  const out: Slot<T>[] = [];
  let g = 0;
  let r = 0;
  for (let pos = 1; pos <= total; pos++) {
    if (pos % 3 === 0 && r < rented) {
      out.push({ kind: "rented", position: pos, rentIndex: r });
      r++;
    } else if (g < rankedGuests.length) {
      out.push({ kind: "guest", guest: rankedGuests[g], position: pos });
      g++;
    } else {
      out.push({ kind: "rented", position: pos, rentIndex: r });
      r++;
    }
  }
  return out;
}

/** Visitor view: odd row → 1 Sponsor with Hostme card, even → 2. No guests → none. */
export function sponsorRowCount(displayedItems: number, guests: number): number {
  if (guests <= 0) return 0;
  return displayedItems % 2 === 1 ? 1 : 2;
}

/** Discovery/search feed: slots 3, 6, 9, 11 and 12 of every group of 12 prefer Sponsor with Hostme. */
export const FEED_GROUP = 12;
export function feedSlotIsSponsor(index: number): boolean {
  const pos = (index % FEED_GROUP) + 1;
  return pos % 3 === 0 || pos === 11 || pos === 12;
}

export function sponsorSlotsPerGroup(): number {
  let n = 0;
  for (let i = 0; i < FEED_GROUP; i++) if (feedSlotIsSponsor(i)) n++;
  return n;
}

export function earningsFromViews(views: number): number {
  return Math.round(views * PER_VIEW_USD * 1000) / 1000;
}
