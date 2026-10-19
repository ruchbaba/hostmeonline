import { useState, type RefObject } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { ImageCanvasHandle } from "@/components/hostme/ImageCanvas";
import { blobToDataUrl } from "@/lib/image";
import { uploadBanner } from "@/lib/api";
import { moderateImage } from "@/lib/moderation.functions";

export type UploadStage = "idle" | "compressing" | "checking" | "uploading";

/** Compress (1200px WebP) → safety check → upload. Returns the stored public URL. */
export function useBannerUpload() {
  const [stage, setStage] = useState<UploadStage>("idle");
  const moderate = useServerFn(moderateImage);

  async function run(canvas: RefObject<ImageCanvasHandle | null>, folder: string): Promise<string> {
    try {
      setStage("compressing");
      const blob = await canvas.current?.exportBlob();
      if (!blob) throw new Error("Choose an image first");
      setStage("checking");
      const dataUrl = await blobToDataUrl(blob);
      const verdict = await moderate({ data: { dataUrl } });
      if (!verdict.allowed) throw new Error(verdict.reason || "This image can't be published on Hostme.");
      setStage("uploading");
      return await uploadBanner(blob, folder);
    } finally {
      setStage("idle");
    }
  }

  const label =
    stage === "compressing"
      ? "Optimizing image…"
      : stage === "checking"
        ? "Checking image…"
        : stage === "uploading"
          ? "Uploading banner…"
          : "";

  return { run, stage, busy: stage !== "idle", label };
}
