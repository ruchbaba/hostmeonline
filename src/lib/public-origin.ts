/** Public address of the published app; preview addresses need a Lovable login, so shared codes never use them. */
export const PUBLISHED_ORIGIN = "https://hostmeonline.com";

/** Maps a preview/editor origin to the published one; real domains (published, custom, localhost) stay as they are. */
export function publicOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith(".lovableproject.com") || u.hostname.endsWith(".lovable.app") || u.hostname.endsWith(".vercel.app") || u.hostname === "www.hostmeonline.com") return PUBLISHED_ORIGIN;
    return u.origin;
  } catch {
    return PUBLISHED_ORIGIN;
  }
}

export function browserPublicOrigin(): string {
  return typeof window === "undefined" ? PUBLISHED_ORIGIN : publicOrigin(window.location.origin);
}
