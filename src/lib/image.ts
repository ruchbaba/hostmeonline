// Client-side banner processing: 16:9 crop → max 1200px wide → WebP ~82% quality.
export const MAX_BANNER_WIDTH = 1200;
export const WEBP_QUALITY = 0.82;

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image"));
    img.src = src;
  });
}

export async function cropToWebp(img: HTMLImageElement, crop: CropRect): Promise<Blob> {
  const width = Math.round(Math.min(MAX_BANNER_WIDTH, Math.max(320, crop.sw)));
  const height = Math.round((width * 9) / 16);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", WEBP_QUALITY));
  if (!blob) throw new Error("Could not compress image");
  return blob;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Stored banner URLs are app-relative (/api/public/img/...). Make absolute for sharing. */
export function absoluteUrl(url: string, origin?: string): string {
  if (!url) return url;
  if (/^https?:\/\//.test(url)) return url;
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return base + url;
}
