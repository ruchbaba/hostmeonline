/**
 * Guide-page banners can hold either an uploaded image URL or a live Hostme embed.
 * Embeds are stored origin-free as "/embed/<slug>" so they work on every domain.
 */
const SLUG = /\/embed\/([a-z0-9][a-z0-9-]{0,80})(?=[/?#"'\s]|$)/i;
const HOME_SLUG = "hostme";

/** Slug from a shared page link like https://site/<slug>?src=embed (the root page is the Hostme home). */
function slugFromShareLink(text: string): string | null {
  const href = /href\s*=\s*["']([^"']+)["']/i.exec(text)?.[1] ?? text.split(/\s+/)[0] ?? "";
  try {
    const u = new URL(href);
    if (u.searchParams.get("src") !== "embed") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return HOME_SLUG;
    if (parts.length === 1 && /^[a-z0-9][a-z0-9-]{0,80}$/i.test(parts[0]!)) return parts[0]!.toLowerCase();
    return null;
  } catch {
    return null;
  }
}

/** Extract the host slug from a pasted share code: an <iframe> tag, a full embed URL, "/embed/slug", or the shared page link. */
export function parseEmbedCode(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const src = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(t)?.[1] ?? t;
  const m = SLUG.exec(src);
  if (m) return m[1]!.toLowerCase();
  return slugFromShareLink(t);
}

/** Stored banner value for an embed slug. */
export const embedValue = (slug: string) => `/embed/${slug}`;

/** If a stored banner value is an embed, return its slug. Uploaded image URLs return null. */
export function embedSlugOf(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/embed/")) return null;
  return parseEmbedCode(value);
}

/** Everything one Copy button puts on the clipboard: rich banner+link for emails/docs, plain link for bios and chats. */
export function shareBundle({ origin, slug, name, isHome }: { origin: string; slug: string; name: string; isHome: boolean }) {
  const page = isHome ? `${origin}/?src=embed` : `${origin}/${slug}?src=embed`;
  const image = `${origin}/api/public/banner/${slug}`;
  const title = `${name} on Hostme`.replace(/[<>"&]/g, "");
  const iframe = `<iframe src="${origin}/embed/${slug}" title="${title}" style="border:0;width:100%;max-width:480px;aspect-ratio:16/9;border-radius:12px" loading="lazy"></iframe>`;
  const html = `<a href="${page}"><img src="${image}" alt="${title}" width="480" height="270" style="max-width:100%;height:auto;border-radius:12px;object-fit:cover"/></a><br/><a href="${page}">${title}</a>`;
  return { page, image, iframe, html, plain: page };
}
