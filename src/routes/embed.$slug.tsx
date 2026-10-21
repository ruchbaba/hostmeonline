import { useEffect, useMemo, useRef } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getEmbedHost } from "@/lib/public.functions";
import { fetchGuests, fire, pickSponsors } from "@/lib/api";
import { useRotating } from "@/hooks/use-rotating";
import { useImpression } from "@/hooks/use-impression";
import { compact } from "@/lib/format";
import { Frame169 } from "@/components/hostme/Banner";

const embedQuery = (slug: string) =>
  queryOptions({ queryKey: ["embed", slug], queryFn: () => getEmbedHost({ data: { slug } }), staleTime: 60_000 });

export const Route = createFileRoute("/embed/$slug")({
  loader: async ({ context, params }) => {
    const res = await context.queryClient.ensureQueryData(embedQuery(params.slug));
    if (!res.host) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.host?.name ?? "Hostme";
    return {
      meta: [
        { title: `${name} · Hostme live banner` },
        { name: "description", content: `Live Hostme banner for ${name}. Every banner is a window to somewhere.` },
        { property: "og:title", content: `${name} · Hostme live banner` },
        { property: "og:description", content: `Live Hostme banner for ${name}.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: EmbedPage,
});

/** Session key that survives blocked third-party storage inside iframes. */
let memKey = "";
const rid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
function embedSession(): string {
  try {
    let k = sessionStorage.getItem("hostme_session");
    if (!k) {
      k = rid();
      sessionStorage.setItem("hostme_session", k);
    }
    return k;
  } catch {
    if (!memKey) memKey = rid();
    return memKey;
  }
}

interface Slide {
  key: string;
  slug: string;
  name: string;
  image: string;
  views: number;
  campaignId?: string;
}

function EmbedPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(embedQuery(slug));
  const host = data.host!;
  const origin = data.origin || "";

  const guestsQ = useQuery({ queryKey: ["embed-guests", host.id], queryFn: () => fetchGuests(host.id), staleTime: 60_000 });
  const sponsorQ = useQuery({
    queryKey: ["embed-sponsor", host.id],
    enabled: host.rent_enabled && guestsQ.isSuccess,
    staleTime: 60_000,
    queryFn: () => pickSponsors("hosts", host.tags, [host.id, ...(guestsQ.data ?? []).map((g) => g.id)], 1),
  });

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [{ key: host.id, slug: host.slug, name: host.name, image: host.image_url, views: host.views }];
    for (const g of (guestsQ.data ?? []).slice(0, 6)) {
      list.push({ key: g.id, slug: g.slug, name: g.name, image: g.image_url, views: g.views });
    }
    const s = sponsorQ.data?.[0];
    // Rented spot: every 3rd slide position goes to a Sponsor with Hosts banner.
    if (s) list.splice(Math.min(2, list.length), 0, { key: `c-${s.campaign_id}`, slug: s.slug, name: s.name, image: s.image_url, views: s.views, campaignId: s.campaign_id });
    return list;
  }, [host, guestsQ.data, sponsorQ.data]);

  const { item, index } = useRotating(slides, 5000);

  // Count one shared Sparkle impression for the host once the banner is fully seen for 1s.
  const ref = useImpression<HTMLAnchorElement>(() => {
    void fire(supabase.rpc("track_shared_impression", { p_host: host.id, p_session: embedSession() }));
  }, host.id);

  // Paid sponsor slide counts as a shared impression after 1s on screen.
  const tracked = useRef(new Set<string>());
  useEffect(() => {
    const c = item?.campaignId;
    if (!c || tracked.current.has(c)) return;
    const t = setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      tracked.current.add(c);
      void fire(supabase.rpc("track_impression", { p_campaign: c, p_host: host.id, p_context: "shared", p_session: embedSession() }));
    }, 1000);
    return () => clearTimeout(t);
  }, [item?.campaignId, host.id]);

  if (!item) return null;
  const href = item.slug === host.slug && host.is_home ? `${origin}/?src=embed` : `${origin}/${item.slug}?src=embed${item.slug !== host.slug ? `&ref=${host.id}` : ""}`;

  return (
    <main className="min-h-screen bg-transparent p-0">
      <a ref={ref} href={href} target="_blank" rel="noopener" className="press block" aria-label={`${item.name} on Hostme`}>
        <Frame169 key={item.key} src={item.image} alt={item.name} className="hm-fade-in rounded-xl">
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-overlay px-2 py-0.5 text-xs font-semibold text-overlay-foreground backdrop-blur">
            <Eye className="h-3.5 w-3.5" />
            {compact(item.views)}
          </span>
          <span className="absolute right-2 top-2 rounded-full bg-overlay px-2 py-0.5 font-display text-xs font-bold text-overlay-foreground backdrop-blur">
            Host<span className="text-gold">me</span>
          </span>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-overlay to-transparent px-3 pb-2 pt-6">
            <p className="truncate text-sm font-semibold text-overlay-foreground">{item.name}</p>
          </div>
          {slides.length > 1 && (
            <div className="absolute bottom-2 right-3 flex gap-1">
              {slides.map((s, i) => (
                <span key={s.key} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-gold" : "bg-overlay-foreground/40"}`} />
              ))}
            </div>
          )}
        </Frame169>
      </a>
    </main>
  );
}
