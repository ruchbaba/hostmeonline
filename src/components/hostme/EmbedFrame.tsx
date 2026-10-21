import { cn } from "@/lib/utils";

/** Live Hostme embed (same origin) inside a strict 16:9 frame. */
export function EmbedFrame({ slug, title, className }: { slug: string; title: string; className?: string }) {
  return (
    <div className={cn("relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted shadow-card", className)}>
      <iframe src={`/embed/${slug}`} title={title} loading="lazy" className="absolute inset-0 h-full w-full border-0" />
    </div>
  );
}
