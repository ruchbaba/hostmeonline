import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getEmbedHost } from "@/lib/public.functions";
import { fetchGuests, qk } from "@/lib/api";
import { useRotating } from "@/hooks/use-rotating";
import { cn } from "@/lib/utils";
import { Frame169 } from "./Banner";

/**
 * In-app version of a Host's shared banner: the same host → guests loop shown in the share popup,
 * switching every 5 seconds, with no overlays. Any tap opens the sharing Host's page; a guest
 * slide is pinned to that page's first guest slot.
 */
export function LiveHostBanner({ slug, className }: { slug: string; className?: string }) {
  const hostQ = useQuery({ queryKey: ["embed", slug], queryFn: () => getEmbedHost({ data: { slug } }), staleTime: 60_000 });
  const host = hostQ.data?.host ?? null;
  const guestsQ = useQuery({
    queryKey: qk.guests(host?.id ?? ""),
    enabled: !!host,
    queryFn: () => fetchGuests(host!.id),
    staleTime: 60_000,
  });

  const slides = host
    ? [
        { key: host.id, name: host.name, image: host.image_url },
        ...(guestsQ.data ?? []).map((g) => ({ key: g.id, name: g.name, image: g.image_url })),
      ]
    : [];
  const { item } = useRotating(slides, 5000);

  if (!host || !item) return <div className={cn("aspect-[16/9] w-full animate-pulse rounded-xl bg-muted", className)} />;
  const search = item.key === host.id ? {} : { ref: item.key };

  return host.is_home ? (
    <Link to="/" search={search} className={cn("press block rounded-xl", className)} aria-label={`${host.name} on Hostme`}>
      <Frame169 key={item.key} src={item.image} alt={item.name} className="hm-fade-in" />
    </Link>
  ) : (
    <Link to="/$slug" params={{ slug: host.slug }} search={search} className={cn("press block rounded-xl", className)} aria-label={`${host.name} on Hostme`}>
      <Frame169 key={item.key} src={item.image} alt={item.name} className="hm-fade-in" />
    </Link>
  );
}
