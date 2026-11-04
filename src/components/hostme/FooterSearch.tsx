import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { DoorOpen, Eye, Loader2, MapPin, Search, SlidersHorizontal, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { pickSponsors, trackImpression, type Host } from "@/lib/api";
import { FEED_GROUP, feedSlotIsSponsor, sponsorSlotsPerGroup } from "@/lib/slots";
import { expandTerms } from "@/lib/tags";
import { compact } from "@/lib/format";
import { SEARCH_EVENT } from "@/lib/prefs";
import { currentPlace, NEAR_SCOPES, type NearScope, type Place } from "@/lib/location";
import { cn } from "@/lib/utils";
import { HostCard } from "./Banner";
import { ThemeToggle } from "./ThemeToggle";

export const FOOTER_SLOGAN = "Every banner is a window to somewhere.";

interface Filters {
  views: number;
  stars: number;
  entries: number;
}

interface FeedCard {
  key: string;
  slug: string;
  name: string;
  image: string;
  views: number;
  campaignId?: string;
}

export function FooterSearch({ contextTags = [], excludeIds = [] }: { contextTags?: string[]; excludeIds?: string[] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ views: 0, stars: 0, entries: 0 });
  const [filterOpen, setFilterOpen] = useState(false);
  const [scope, setScope] = useState<NearScope>("all");
  const [place, setPlace] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  const [seed] = useState(() => Math.random().toString(36).slice(2));
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onSearch = () => {
      setOpen(true);
      setTimeout(() => rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    };
    window.addEventListener(SEARCH_EVENT, onSearch);
    return () => window.removeEventListener(SEARCH_EVENT, onSearch);
  }, []);

  const lastWord = value.split(/\s+/).pop() ?? "";
  const sugg = useQuery({
    queryKey: ["tag-suggest", lastWord.toLowerCase()],
    enabled: open && lastWord.replace(/^#/, "").length >= 1,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("tag_suggestions", { p_prefix: lastWord });
      return (data ?? []).map((d) => d.tag);
    },
  });
  const prefix = lastWord.replace(/^#/, "").toLowerCase();
  const best = (sugg.data ?? []).find((t) => t.startsWith(prefix) && t !== prefix);
  const ghost = best && prefix ? best.slice(prefix.length) : "";

  const submit = () => {
    const full = ghost ? value + ghost : value;
    setValue(full);
    setQuery(full.trim());
  };

  const terms = useMemo(() => expandTerms(query), [query]);
  const sponsorTags = query ? terms : contextTags;
  const exclude = excludeIds.join(",");
  const near = scope !== "all" && place ? { p_scope: scope, p_lat: place.lat, p_lng: place.lng, p_city: place.city, p_region: place.region, p_country: place.country } : null;

  const pickScope = async (v: NearScope) => {
    if (v === "all") return setScope("all");
    if (place) return setScope(v);
    setLocating(true);
    try {
      setPlace(await currentPlace());
      setScope(v);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get your location");
    } finally {
      setLocating(false);
    }
  };

  const feed = useInfiniteQuery({
    queryKey: ["feed", query, terms.join(","), filters, seed, sponsorTags.join(","), exclude, near],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;
      const base = { p_min_views: filters.views, p_min_stars: filters.stars, p_min_entries: filters.entries, p_limit: FEED_GROUP, p_offset: offset };
      const hostsRes = query
        ? near
          ? await supabase.rpc("search_hosts_near", { p_q: query, p_terms: terms, ...base, ...near })
          : await supabase.rpc("search_hosts", { p_q: query, p_terms: terms, ...base })
        : near
          ? await supabase.rpc("discover_hosts_near", { p_seed: seed, ...base, ...near })
          : await supabase.rpc("discover_hosts", { p_seed: seed, ...base });
      let hosts = ((hostsRes.data ?? []) as Host[]).filter((h) => !excludeIds.includes(h.id));
      // Pre-search suggestions never run out: once every host was shown, start a fresh shuffled round
      // so each scroll always brings a full group of FEED_GROUP cards.
      if (!query && !near && hosts.length < FEED_GROUP) {
        const again = await supabase.rpc("discover_hosts", {
          p_seed: `${seed}-${offset}`,
          p_min_views: filters.views,
          p_min_stars: filters.stars,
          p_min_entries: filters.entries,
          p_limit: FEED_GROUP,
          p_offset: 0,
        });
        const pool = ((again.data ?? []) as Host[]).filter((h) => !excludeIds.includes(h.id));
        const seen = new Set(hosts.map((h) => h.id));
        const fresh = [...pool.filter((h) => !seen.has(h.id)), ...pool.filter((h) => seen.has(h.id))];
        while (pool.length && hosts.length < FEED_GROUP) hosts = [...hosts, ...fresh].slice(0, FEED_GROUP);
      }
      const sponsors = await pickSponsors("hostme", sponsorTags, excludeIds, sponsorSlotsPerGroup()).catch(() => []);
      const cards: FeedCard[] = [];
      let hi = 0;
      let si = 0;
      for (let i = 0; i < FEED_GROUP; i++) {
        if (feedSlotIsSponsor(i) && si < sponsors.length) {
          const s = sponsors[si++];
          cards.push({ key: `s-${s.campaign_id}-${offset}-${i}`, slug: s.slug, name: s.name, image: s.image_url, views: s.views, campaignId: s.campaign_id });
        } else if (hi < hosts.length) {
          const h = hosts[hi++];
          cards.push({ key: `h-${h.id}-${offset}-${i}`, slug: h.slug, name: h.name, image: h.image_url, views: h.views });
        }
      }
      const fetched = (hostsRes.data ?? []).length;
      if (!query && !near) return { cards, next: cards.length ? offset + FEED_GROUP : null };
      return { cards, next: fetched < FEED_GROUP && hi >= hosts.length ? null : offset + Math.max(1, hi) };
    },
    getNextPageParam: (last) => last.next,
  });

  // Load more only while the user is actively scrolling, so the slogan and
  // theme toggle stay reachable when they stop.
  const feedRef = useRef(feed);
  feedRef.current = feed;
  // Infinite feed rule: the first scroll only brings you to the very bottom (slogan + Sun/Moon
  // stay readable and tappable). A SECOND, separate scroll made while already at the bottom loads
  // the next group. A gesture ends after a 600ms pause or when the finger is lifted and touches again.
  useEffect(() => {
    let lastInput = 0;
    let gesture = 0;
    let bottomGesture = -1; // gesture during which the bottom was first reached
    const atBottom = () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;
    const busy = () => feedRef.current.isFetching || feedRef.current.isFetchingNextPage;
    const step = () => {
      const now = Date.now();
      if (now - lastInput > 600) gesture++;
      lastInput = now;
      const f = feedRef.current;
      if (busy() || !f.hasNextPage) return;
      if (!atBottom()) {
        bottomGesture = -1;
        return;
      }
      if (bottomGesture < 0) {
        bottomGesture = gesture;
        return;
      }
      if (gesture > bottomGesture) {
        bottomGesture = -1;
        void f.fetchNextPage();
      }
    };
    const onScroll = () => step();
    const onWheel = (e: WheelEvent) => e.deltaY > 0 && step();
    // A new touch starts a new gesture but never loads by itself (tapping Sun/Moon stays safe).
    const onTouchStart = () => {
      gesture++;
      lastInput = Date.now();
    };
    const onTouchMove = () => step();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  const cards = (feed.data?.pages ?? []).flatMap((p) => p.cards);
  const hasFilters = filters.views + filters.stars + filters.entries > 0 || scope !== "all";

  return (
    <footer ref={rootRef} className="relative space-y-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-4">
      <div className="flex flex-col items-center gap-3">
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            aria-label="Search"
            className="press inline-flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-card text-gold shadow-gold hover:bg-gold-soft"
          >
            <Search className="h-6 w-6" />
          </button>
        ) : (
          <div className="hm-fade-in w-full space-y-1.5">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="relative flex-1">
                <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre px-4 text-base">
                  <span className="text-transparent">{value}</span>
                  <span className="text-suggest">{ghost}</span>
                </div>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Tab" || e.key === "ArrowRight") && ghost) {
                      e.preventDefault();
                      setValue(value + ghost);
                    }
                  }}
                  placeholder="Search hosts, topics, #tags"
                  className="h-12 w-full rounded-full border border-input bg-card px-4 text-base outline-none placeholder:text-muted-foreground focus:border-suggest/60"
                  aria-label="Search"
                />
              </div>
              <button type="button" aria-label="Filters" onClick={() => setFilterOpen(true)} className="press inline-flex h-12 w-12 items-center justify-center rounded-full border bg-card hover:bg-accent">
                <SlidersHorizontal className="h-5 w-5" />
              </button>
              <button type="submit" aria-label="Search" className="press inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold-gradient text-gold-foreground shadow-gold">
                <Search className="h-5 w-5" />
              </button>
            </form>
            {(sugg.data ?? []).length > 0 && prefix && (
              <div className="flex flex-wrap gap-1.5 px-2">
                {(sugg.data ?? []).slice(0, 12).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      const parts = value.split(/\s+/);
                      parts[parts.length - 1] = t;
                      const v = parts.join(" ");
                      setValue(v);
                      setQuery(v.trim());
                    }}
                    className="press rounded-full bg-suggest/10 px-2.5 py-0.5 text-xs text-suggest hover:bg-suggest/20"
                  >
                    #{t}
                  </button>
                ))}
              </div>
            )}
            {hasFilters && (
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />≥{compact(filters.views)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5" />≥{compact(filters.stars)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <DoorOpen className="h-3.5 w-3.5" />≥{compact(filters.entries)}
                </span>
                {scope !== "all" && (
                  <span className="inline-flex items-center gap-1 text-gold">
                    <MapPin className="h-3.5 w-3.5" />
                    {NEAR_SCOPES.find((n) => n.value === scope)?.label}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <HostCard
            key={c.key}
            slug={c.slug}
            name={c.name}
            image={c.image}
            views={c.views}
            onImpression={c.campaignId ? () => trackImpression(c.campaignId!, null, "inapp") : null}
            impressionKey={c.key}
          />
        ))}
      </div>
      {feed.isFetching && (
        <div className="flex justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {feed.isSuccess && cards.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">{query ? "No matching hosts yet." : "New hosts will appear here."}</p>
      )}
      <div className="flex justify-center pt-6">
        <ThemeToggle />
      </div>
      <p className="pt-3 text-center font-display text-lg text-muted-foreground">{FOOTER_SLOGAN}</p>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Filters</DialogTitle>
          </DialogHeader>
          <FilterSlider icon={<Eye />} label="Minimum views" max={10000} step={50} value={filters.views} onChange={(v) => setFilters((f) => ({ ...f, views: v }))} />
          <FilterSlider icon={<Star />} label="Minimum stars" max={1000} step={5} value={filters.stars} onChange={(v) => setFilters((f) => ({ ...f, stars: v }))} />
          <FilterSlider icon={<DoorOpen />} label="Minimum entries" max={1000} step={5} value={filters.entries} onChange={(v) => setFilters((f) => ({ ...f, entries: v }))} />
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Near me
              </span>
              {locating && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {NEAR_SCOPES.map((n) => (
                <button
                  key={n.value}
                  type="button"
                  disabled={locating}
                  aria-pressed={scope === n.value}
                  onClick={() => void pickScope(n.value)}
                  className={cn(
                    "press rounded-full border px-3 py-1 text-xs",
                    scope === n.value ? "border-gold bg-gold-soft text-gold" : "text-muted-foreground hover:border-gold/40",
                  )}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setFilters({ views: 0, stars: 0, entries: 0 });
                setScope("all");
              }}
            >
              Reset
            </Button>
            <Button variant="gold" className="flex-1" onClick={() => setFilterOpen(false)}>
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </footer>
  );
}

function FilterSlider({ icon, label, max, step, value, onChange }: { icon: React.ReactNode; label: string; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm [&_svg]:h-4 [&_svg]:w-4">
        <span className="inline-flex items-center gap-2">
          {icon} {label}
        </span>
        <span className="tabular-nums text-gold">{compact(value)}</span>
      </div>
      <Slider value={[value]} max={max} step={step} onValueChange={(v) => onChange(v[0] ?? 0)} />
    </div>
  );
}
