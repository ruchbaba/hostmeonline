// Tag families (categories) for approximate / semantic matching. A search term expands to its whole family.
const FAMILIES: string[][] = [
  ["design", "designer", "ui", "ux", "graphic", "branding", "logo", "illustration", "art", "creative", "designbarter"],
  ["art", "artist", "painting", "drawing", "illustration", "gallery", "craft", "handmade", "sculpture"],
  ["music", "musician", "band", "song", "singer", "producer", "beats", "dj", "podcast", "audio", "guitar", "guitarist", "piano", "drums", "rock", "jazz", "hiphop", "rap"],
  ["video", "youtube", "film", "filmmaker", "vlog", "streaming", "twitch", "animation", "movie", "cinema"],
  ["photo", "photography", "photographer", "camera", "portrait", "travel"],
  ["writing", "writer", "blog", "blogger", "newsletter", "author", "books", "poetry", "newsletterswap"],
  ["tech", "technology", "software", "developer", "dev", "code", "coding", "programming", "saas", "startup", "ai", "app"],
  ["business", "startup", "entrepreneur", "marketing", "sales", "agency", "consulting", "smallbusiness", "shop", "store", "ecommerce"],
  ["marketing", "seo", "growth", "ads", "traffic", "social", "socialmedia", "influencer"],
  ["food", "recipe", "cooking", "chef", "restaurant", "bakery", "vegan", "coffee"],
  ["fitness", "health", "wellness", "yoga", "gym", "nutrition", "running", "sport", "sports", "meditation"],
  ["fashion", "style", "clothing", "beauty", "makeup", "jewelry", "streetwear"],
  ["travel", "adventure", "tourism", "hotel", "explore", "nomad"],
  ["games", "gaming", "gamer", "esports", "indiegame", "boardgames"],
  ["education", "learning", "course", "teacher", "tutor", "school", "coach", "coaching"],
  ["nonprofit", "charity", "cause", "community", "volunteer", "climate", "sustainability", "eco"],
  ["collab", "opentocollab", "partnership", "swap", "barter", "exchange", "newsletterswap", "designbarter"],
  ["finance", "crypto", "investing", "money", "fintech"],
  ["home", "interior", "decor", "garden", "diy", "architecture"],
  ["pets", "dogs", "cats", "animals", "wildlife", "lion", "tiger", "elephant", "panda", "monkey", "fox", "snake"],
  ["nature", "wildlife", "outdoors", "forest", "ocean", "mountains", "eco"],
  ["spiritual", "spirituality", "religion", "god", "temple", "mantra", "yoga", "meditation", "ganesh"],
  ["king", "queen", "royal", "royalty", "crown", "kingdom", "leader"],
];

export function normalizeTag(t: string): string {
  return t.trim().replace(/^#+/, "").toLowerCase().replace(/[^a-z0-9-]+/g, "").slice(0, 32);
}

/** Edit distance with early exit once it exceeds `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** True when a searched word means the same family word: exact, word form, compound or a small typo. */
export function relatedWord(w: string, f: string): boolean {
  if (w === f) return true;
  if (w.length < 4 || f.length < 3) return false;
  if (f.length >= 4 && (f.startsWith(w) || w.startsWith(f))) return true; // design ↔ designer
  if (f.length >= 5 && w.includes(f)) return true; // streetphotography → photography
  const max = w.length >= 7 ? 2 : 1;
  return distance(w, f, max) <= max; // photograpy → photography
}

/** Expand free text into normalized words plus every word of their related families (typed words first). */
export function expandTerms(q: string): string[] {
  const words = q
    .split(/[\s,]+/)
    .map(normalizeTag)
    .filter(Boolean);
  const out = new Set<string>(words);
  for (const w of words) {
    for (const fam of FAMILIES) {
      if (fam.some((f) => relatedWord(w, f))) fam.forEach((f) => out.add(f));
    }
  }
  return [...out].slice(0, 60);
}

export function familyWords(): string[] {
  return [...new Set(FAMILIES.flat())];
}
