// Tag families for approximate / semantic matching. A search term expands to its whole family.
const FAMILIES: string[][] = [
  ["design", "designer", "ui", "ux", "graphic", "branding", "logo", "illustration", "art", "creative", "designbarter"],
  ["art", "artist", "painting", "drawing", "illustration", "gallery", "craft", "handmade"],
  ["music", "musician", "band", "song", "producer", "beats", "dj", "podcast", "audio"],
  ["video", "youtube", "film", "filmmaker", "vlog", "streaming", "twitch", "animation"],
  ["photo", "photography", "photographer", "camera", "portrait", "travel"],
  ["writing", "writer", "blog", "blogger", "newsletter", "author", "books", "poetry", "newsletterswap"],
  ["tech", "technology", "software", "developer", "dev", "code", "coding", "programming", "saas", "startup", "ai", "app"],
  ["business", "startup", "entrepreneur", "marketing", "sales", "agency", "consulting", "smallbusiness"],
  ["marketing", "seo", "growth", "ads", "traffic", "social", "socialmedia", "influencer"],
  ["food", "recipe", "cooking", "chef", "restaurant", "bakery", "vegan", "coffee"],
  ["fitness", "health", "wellness", "yoga", "gym", "nutrition", "running", "sport", "sports"],
  ["fashion", "style", "clothing", "beauty", "makeup", "jewelry", "streetwear"],
  ["travel", "adventure", "tourism", "hotel", "explore", "nomad"],
  ["games", "gaming", "gamer", "esports", "indiegame", "boardgames"],
  ["education", "learning", "course", "teacher", "tutor", "school", "coach", "coaching"],
  ["nonprofit", "charity", "cause", "community", "volunteer", "climate", "sustainability", "eco"],
  ["collab", "opentocollab", "partnership", "swap", "barter", "exchange", "newsletterswap", "designbarter"],
  ["finance", "crypto", "investing", "money", "fintech"],
  ["home", "interior", "decor", "garden", "diy", "architecture"],
  ["pets", "dogs", "cats", "animals"],
];

export function normalizeTag(t: string): string {
  return t.trim().replace(/^#+/, "").toLowerCase().replace(/[^a-z0-9-]+/g, "").slice(0, 32);
}

/** Expand free text into normalized tags plus their families (most related first). */
export function expandTerms(q: string): string[] {
  const words = q
    .split(/[\s,]+/)
    .map(normalizeTag)
    .filter(Boolean);
  const out = new Set<string>(words);
  for (const w of words) {
    for (const fam of FAMILIES) {
      if (fam.some((f) => f === w || (w.length >= 4 && (f.startsWith(w) || w.startsWith(f))))) {
        fam.forEach((f) => out.add(f));
      }
    }
  }
  return [...out].slice(0, 40);
}

export function familyWords(): string[] {
  return [...new Set(FAMILIES.flat())];
}
