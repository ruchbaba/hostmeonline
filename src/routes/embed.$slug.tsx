import { useEffect, useMemo, useRef } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getEmbedHost } from "@/lib/public.functions";
import { fetchGuests, fire, pickSponsors } from "@/lib/api";
import { useRotating } from "@/hooks/use-rotating";
import { useImpression } from "@/hooks/use-impression";
import { publicOrigin } from "@/lib/public-origin";
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

  const { item } = useRotating(slides, 5000);

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
  // Every click lands on the sharing Host's page; a guest slide is pinned to its first guest slot.
  // Sponsor slides open the sponsor's own page.
  const base = publicOrigin(origin || window.location.origin);
  const href = item.campaignId
    ? `${base}/${item.slug}?src=embed`
    : `${base}/${host.is_home ? "" : host.slug}?src=embed${item.key !== host.id ? `&ref=${item.key}` : ""}`;

  return (
    <main className="min-h-screen bg-transparent p-0">
      <a ref={ref} href={href} target="_blank" rel="noopener" className="press block" aria-label={`${host.name} on Hostme`}>
        <Frame169 key={item.key} src={item.image} alt={item.name} className="hm-fade-in rounded-xl" />
      </a>
    </main>
  );
}
