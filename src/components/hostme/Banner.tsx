import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { compact } from "@/lib/format";
import { useImpression } from "@/hooks/use-impression";
import fallback from "@/assets/hostme-fallback.jpg";

/** Strict 16:9 frame with object-cover image. */
export function Frame169({
  src,
  alt,
  className,
  children,
  imgClassName,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  children?: ReactNode;
}) {
  // Convert any legacy proxy URLs directly to Supabase public storage
  const imageSrc = src?.startsWith("/api/public/img/")
    ? `https://c--8eb811f9-d356-4979-8e43-67e94377fbee-prod.lovable.cloud/storage/v1/object/public/banners/${src.replace("/api/public/img/", "")}`
    : src;

  return (
    <div className={cn("relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted shadow-card", className)}>
      <img
        src={imageSrc || fallback}
        alt={alt}
        loading="lazy"
        draggable={false}
        className={cn("absolute inset-0 h-full w-full select-none object-cover", imgClassName)}
      />
      {children}
    </div>
  );
}

export function ViewsBadge({ views }: { views: number }) {
  return (
    <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-overlay px-2 py-0.5 text-xs font-semibold text-overlay-foreground backdrop-blur">
      <Eye className="h-3.5 w-3.5" />
      {compact(views)}
    </span>
  );
}

/**
 * A card linking to a host page. Guests, rented ads, sponsors and random hosts all look identical.
 * When `onImpression` is given, it fires after the card is fully visible for 1s.
 */
export function HostCard({
  slug,
  name,
  image,
  views,
  refId,
  onImpression,
  impressionKey,
  className,
  children,
}: {
  slug: string;
  name: string;
  image: string;
  views: number;
  refId?: string | null;
  onImpression?: (() => void) | null;
  impressionKey?: string;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useImpression<HTMLAnchorElement>(onImpression ?? null, impressionKey);
  return (
    <Link
      ref={ref}
      to="/$slug"
      params={{ slug }}
      search={refId ? { ref: refId } : {}}
      className={cn("press group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      aria-label={name}
    >
      <Frame169 src={image} alt={name} imgClassName="transition-transform duration-500 group-hover:scale-[1.03]">
        <ViewsBadge views={views} />
        {children}
      </Frame169>
    </Link>
  );
}
