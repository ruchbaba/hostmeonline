import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { getEmbedHost } from "@/lib/public.functions";
import { fetchGuests, qk } from "@/lib/api";
import { useRotating } from "@/hooks/use-rotating";
import { compact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Frame169 } from "./Banner";

/**
 * In-app version of a Host's shared banner: the same host → guests loop shown in the share popup,
 * switching every 5 seconds. Tapping opens the slide's Host page.
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
        { key: host.id, slug: host.slug, name: host.name, image: host.image_url, views: host.views, isHome: host.is_home },
        ...(guestsQ.data ?? []).map((g) => ({ key: g.id, slug: g.slug, name: g.name, image: g.image_url, views: g.views, isHome: false })),
      ]
    : [];
  const { item, index } = useRotating(slides, 5000);

  if (!host || !item) return <div className={cn("aspect-[16/9] w-full animate-pulse rounded-xl bg-muted", className)} />;
  const isHostSlide = item.key === host.id;

  return (
    <Link
      to={item.isHome ? "/" : "/$slug"}
      params={item.isHome ? {} : { slug: item.slug }}
      search={isHostSlide ? {} : { ref: host.id }}
      className={cn("press block rounded-xl", className)}
      aria-label={`${item.name} on Hostme`}
    >
      <Frame169 key={item.key} src={item.image} alt={item.name} className="hm-fade-in">
        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-overlay px-2 py-0.5 text-xs font-semibold text-overlay-foreground backdrop-blur">
          <Eye className="h-3.5 w-3.5" />
          {compact(item.views)}
        </span>
        <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-overlay px-2 py-0.5 font-display text-xs font-bold text-overlay-foreground backdrop-blur">
          Host<span className="text-gold">me</span>
        </span>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-overlay to-transparent px-3 pb-2 pt-6">
          <p className="truncate text-sm font-semibold text-overlay-foreground">{item.name}</p>
        </div>
        {slides.length > 1 && (
          <div className="pointer-events-none absolute bottom-2 right-3 flex gap-1">
            {slides.map((s, i) => (
              <span key={s.key} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-gold" : "bg-overlay-foreground/40"}`} />
            ))}
          </div>
        )}
      </Frame169>
    </Link>
  );
}
