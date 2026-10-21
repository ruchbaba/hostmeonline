/**
 * Guide-page banners can hold either an uploaded image URL or a live Hostme embed.
 * Embeds are stored origin-free as "/embed/<slug>" so they work on every domain.
 */
const SLUG = /\/embed\/([a-z0-9][a-z0-9-]{0,80})(?=[/?#"'\s]|$)/i;

/** Extract the host slug from a pasted share code: an <iframe> tag, a full embed URL, or "/embed/slug". */
export function parseEmbedCode(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const src = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(t)?.[1] ?? t;
  const m = SLUG.exec(src);
  return m ? m[1]!.toLowerCase() : null;
}

/** Stored banner value for an embed slug. */
export const embedValue = (slug: string) => `/embed/${slug}`;

/** If a stored banner value is an embed, return its slug. Uploaded image URLs return null. */
export function embedSlugOf(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/embed/")) return null;
  return parseEmbedCode(value);
}
