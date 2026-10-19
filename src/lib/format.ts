export function compact(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v < 1000) return String(v);
  if (v < 1_000_000) return (v / 1000).toFixed(v < 10_000 ? 1 : 0).replace(/\.0$/, "") + "k";
  return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

export function usd(n: number | null | undefined, digits = 2): string {
  return "$" + (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "page"
  );
}

export function normalizeUrl(u: string): string {
  const t = u.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}
