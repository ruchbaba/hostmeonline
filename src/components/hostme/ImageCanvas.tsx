import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { cropToWebp, loadImage } from "@/lib/image";

export interface ImageCanvasHandle {
  /** Returns the cropped, resized WebP banner, or null when no image was chosen. */
  exportBlob: () => Promise<Blob | null>;
  hasImage: () => boolean;
}

interface View {
  zoom: number; // >= 1, relative to cover fit
  ox: number; // image top-left offset in frame px
  oy: number;
}

/**
 * 16:9 upload canvas. Tap to choose a file, drag to reposition,
 * pinch with two fingers (or mouse wheel) to resize. No sliders.
 */
export const ImageCanvas = forwardRef<ImageCanvasHandle, { initialUrl?: string; className?: string; onChange?: () => void }>(
  function ImageCanvas({ initialUrl, className, onChange }, ref) {
    const frameRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [img, setImg] = useState<HTMLImageElement | null>(null);
    const [src, setSrc] = useState<string | null>(null);
    const [frame, setFrame] = useState({ w: 0, h: 0 });
    const [view, setView] = useState<View>({ zoom: 1, ox: 0, oy: 0 });
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const gesture = useRef<{ dist: number; zoom: number; cx: number; cy: number; ox: number; oy: number } | null>(null);
    const moved = useRef(false);

    useEffect(() => {
      const el = frameRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => setFrame({ w: el.clientWidth, h: el.clientHeight }));
      ro.observe(el);
      setFrame({ w: el.clientWidth, h: el.clientHeight });
      return () => ro.disconnect();
    }, []);

    const cover = img && frame.w ? Math.max(frame.w / img.naturalWidth, frame.h / img.naturalHeight) : 1;
    const scale = cover * view.zoom;

    const clamp = useCallback(
      (v: View): View => {
        if (!img || !frame.w) return v;
        const s = cover * v.zoom;
        const dw = img.naturalWidth * s;
        const dh = img.naturalHeight * s;
        return {
          zoom: v.zoom,
          ox: Math.min(0, Math.max(frame.w - dw, v.ox)),
          oy: Math.min(0, Math.max(frame.h - dh, v.oy)),
        };
      },
      [img, frame.w, frame.h, cover],
    );

    const center = useCallback(
      (image: HTMLImageElement) => {
        if (!frame.w) return;
        const c = Math.max(frame.w / image.naturalWidth, frame.h / image.naturalHeight);
        setView({ zoom: 1, ox: (frame.w - image.naturalWidth * c) / 2, oy: (frame.h - image.naturalHeight * c) / 2 });
      },
      [frame.w, frame.h],
    );

    useEffect(() => {
      if (!initialUrl) return;
      let alive = true;
      loadImage(initialUrl)
        .then((i) => {
          if (!alive) return;
          setImg(i);
          setSrc(initialUrl);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [initialUrl]);

    useEffect(() => {
      if (img) center(img);
    }, [img, center]);

    const pick = async (file: File | undefined) => {
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        const i = await loadImage(url);
        setImg(i);
        setSrc(url);
        onChange?.();
      } catch {
        /* unreadable file */
      }
    };

    const zoomAt = (nextZoom: number, cx: number, cy: number, base: View) => {
      const z = Math.min(5, Math.max(1, nextZoom));
      const ratio = z / base.zoom;
      setView(clamp({ zoom: z, ox: cx - (cx - base.ox) * ratio, oy: cy - (cy - base.oy) * ratio }));
      onChange?.();
    };

    const local = (e: { clientX: number; clientY: number }) => {
      const r = frameRef.current!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onPointerDown = (e: React.PointerEvent) => {
      if (!img) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      pointers.current.set(e.pointerId, local(e));
      moved.current = false;
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        gesture.current = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          zoom: view.zoom,
          cx: (a.x + b.x) / 2,
          cy: (a.y + b.y) / 2,
          ox: view.ox,
          oy: view.oy,
        };
      }
    };

    const onPointerMove = (e: React.PointerEvent) => {
      if (!img || !pointers.current.has(e.pointerId)) return;
      const prev = pointers.current.get(e.pointerId)!;
      const cur = local(e);
      pointers.current.set(e.pointerId, cur);
      if (pointers.current.size === 2 && gesture.current) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const g = gesture.current;
        zoomAt((g.zoom * dist) / Math.max(1, g.dist), g.cx, g.cy, { zoom: g.zoom, ox: g.ox, oy: g.oy });
        moved.current = true;
      } else if (pointers.current.size === 1) {
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        if (Math.abs(dx) + Math.abs(dy) > 1) moved.current = true;
        setView((v) => clamp({ ...v, ox: v.ox + dx, oy: v.oy + dy }));
      }
    };

    const onPointerUp = (e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) gesture.current = null;
      if (moved.current) onChange?.();
    };

    useEffect(() => {
      const el = frameRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        if (!img) return;
        e.preventDefault();
        const r = el.getBoundingClientRect();
        setView((v) => {
          const z = Math.min(5, Math.max(1, v.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
          const ratio = z / v.zoom;
          const cx = e.clientX - r.left;
          const cy = e.clientY - r.top;
          return clamp({ zoom: z, ox: cx - (cx - v.ox) * ratio, oy: cy - (cy - v.oy) * ratio });
        });
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [img, clamp]);

    useImperativeHandle(ref, () => ({
      hasImage: () => !!img,
      exportBlob: async () => {
        if (!img || !frame.w) return null;
        return cropToWebp(img, { sx: -view.ox / scale, sy: -view.oy / scale, sw: frame.w / scale, sh: frame.h / scale });
      },
    }));

    return (
      <div className={cn("space-y-1", className)}>
        <div
          ref={frameRef}
          className={cn(
            "relative aspect-[16/9] w-full touch-none select-none overflow-hidden rounded-xl border border-dashed border-gold/40 bg-muted",
            img ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={() => {
            if (!img) inputRef.current?.click();
          }}
          role="button"
          aria-label="Choose banner image"
        >
          {img && src ? (
            <img
              src={src}
              alt="Banner preview"
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
              style={{
                width: img.naturalWidth,
                height: img.naturalHeight,
                transform: `translate(${view.ox}px, ${view.oy}px) scale(${scale})`,
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gold">
              <ImagePlus className="h-10 w-10" />
            </div>
          )}
          {img && (
            <button
              type="button"
              className="press absolute bottom-2 right-2 rounded-full bg-overlay p-2 text-overlay-foreground backdrop-blur"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              aria-label="Choose another image"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    );
  },
);
