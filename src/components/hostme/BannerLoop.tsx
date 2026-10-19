import { useRotating } from "@/hooks/use-rotating";
import { Frame169 } from "./Banner";

/** GIF-like preview: alternates host → guests every 5 seconds. */
export function BannerLoop({ images, className }: { images: { src: string; alt: string }[]; className?: string }) {
  const list = images.filter((i) => i.src);
  const { item, index } = useRotating(list, 5000);
  if (!item) return null;
  return (
    <div className={className}>
      <Frame169 src={item.src} alt={item.alt}>
        <span key={index} className="hm-fade-in absolute inset-0" />
        {list.length > 1 && (
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {list.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-gold" : "bg-overlay-foreground/40"}`} />
            ))}
          </div>
        )}
      </Frame169>
    </div>
  );
}
