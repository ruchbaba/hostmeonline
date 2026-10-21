import { useRef, useState } from "react";
import { Code2, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBannerUpload } from "@/hooks/use-banner-upload";
import { useMe } from "@/hooks/use-me";
import { embedSlugOf, embedValue, parseEmbedCode } from "@/lib/embed-code";
import { Frame169 } from "./Banner";
import { LiveHostBanner } from "./LiveHostBanner";
import { ImageCanvas, type ImageCanvasHandle } from "./ImageCanvas";

/**
 * Owner-only 16:9 banner picker for guide pages: upload via the crop canvas (plus optional link),
 * or paste a live embed code copied from any Host page's share button.
 */
export function GuideBannerField({
  label,
  url,
  link,
  onChange,
}: {
  label: string;
  url: string;
  link: string;
  onChange: (next: { url: string; link: string }) => void;
}) {
  const { user } = useMe();
  const canvas = useRef<ImageCanvasHandle>(null);
  const upload = useBannerUpload();
  const [picking, setPicking] = useState(false);
  const [code, setCode] = useState("");
  const embedSlug = embedSlugOf(url);

  const save = async () => {
    if (!user) return;
    try {
      const stored = await upload.run(canvas, user.id);
      onChange({ url: stored, link });
      setPicking(false);
      toast.success("Banner uploaded — press Save to publish");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const applyCode = (value: string) => {
    setCode(value);
    if (!value.trim()) return;
    const slug = parseEmbedCode(value);
    if (!slug) return toast.error("Paste the Live embed code from a Host page's share button");
    onChange({ url: embedValue(slug), link: "" });
    setCode("");
    setPicking(false);
    toast.success("Live banner added — press Save to publish");
  };

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {picking ? (
        <>
          <ImageCanvas ref={canvas} />
          <div className="flex gap-2">
            <Button variant="gold" disabled={upload.busy} onClick={() => void save()}>
              {upload.busy ? <Loader2 className="animate-spin" /> : <Upload />} {upload.busy ? upload.label : "Use this banner"}
            </Button>
            <Button variant="outline" disabled={upload.busy} onClick={() => setPicking(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : url ? (
        <div className="relative">
          {embedSlug ? <LiveHostBanner slug={embedSlug} /> : <Frame169 src={url} alt={label} />}
          <div className="absolute right-2 top-2 z-10 flex gap-1">
            <Button size="icon" variant="secondary" onClick={() => setPicking(true)} aria-label="Replace banner">
              <ImagePlus />
            </Button>
            <Button size="icon" variant="secondary" onClick={() => onChange({ url: "", link: "" })} aria-label="Remove banner">
              <Trash2 />
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="press flex aspect-[16/9] w-full items-center justify-center rounded-xl border-2 border-dashed border-gold/40 text-gold hover:bg-gold-soft"
          aria-label={`Add ${label}`}
        >
          <ImagePlus className="h-8 w-8" />
        </button>
      )}
      <div className="relative">
        <Code2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={code}
          onChange={(e) => applyCode(e.target.value)}
          placeholder="Or paste a Live embed code from a share button"
          className="pl-9"
          aria-label={`Paste live embed code for ${label}`}
        />
      </div>
      {!embedSlug && (
        <Input value={link} onChange={(e) => onChange({ url, link: e.target.value })} placeholder="Where the banner opens (optional link)" inputMode="url" />
      )}
    </div>
  );
}
