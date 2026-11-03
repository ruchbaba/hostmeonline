/** Near-me search helpers: browser position (asks permission) + free place lookup. */

export interface Place {
  lat: number;
  lng: number;
  city: string;
  region: string;
  country: string;
}

export type NearScope = "all" | "5" | "10" | "100" | "city" | "state" | "country";

export const NEAR_SCOPES: { value: NearScope; label: string }[] = [
  { value: "5", label: "5 km" },
  { value: "10", label: "10 km" },
  { value: "100", label: "100 km" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "country", label: "Country" },
  { value: "all", label: "All" },
];

export function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("Location isn't available on this device"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? "Location permission was not allowed" : "Could not get your location")),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/** City / state / country for a position, using free keyless lookups (falls back to blanks). */
export async function lookupPlace(lat: number, lng: number): Promise<Omit<Place, "lat" | "lng">> {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    if (r.ok) {
      const d = (await r.json()) as { city?: string; locality?: string; principalSubdivisionCode?: string; principalSubdivision?: string; countryCode?: string };
      if (d.countryCode) return { city: d.city || d.locality || "", region: d.principalSubdivisionCode || d.principalSubdivision || "", country: d.countryCode };
    }
  } catch {
    /* try the next service */
  }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10`);
    if (r.ok) {
      const d = (await r.json()) as { address?: Record<string, string> };
      const a = d.address ?? {};
      return {
        city: a.city || a.town || a.village || a.municipality || "",
        region: a["ISO3166-2-lvl4"] || a.state || "",
        country: (a.country_code || "").toUpperCase(),
      };
    }
  } catch {
    /* blanks below */
  }
  return { city: "", region: "", country: "" };
}

export async function currentPlace(): Promise<Place> {
  const pos = await getPosition();
  return { ...pos, ...(await lookupPlace(pos.lat, pos.lng)) };
}
