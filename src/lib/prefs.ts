// Small browser-only preference store (localStorage) with subscribe support.
// Never call these at module scope or during SSR render — use the hook.
import { useSyncExternalStore } from "react";

export interface ReturningUser {
  name: string;
  email: string;
  slug: string;
}

interface Prefs {
  returning: ReturningUser[];
  lockedHostId: string | null;
  selectedHostId: string | null;
  spying: Record<string, string>; // hostId -> email (visitors without account)
}

const KEY = "hostme_prefs_v1";
const EMPTY: Prefs = { returning: [], lockedHostId: null, selectedHostId: null, spying: {} };
const listeners = new Set<() => void>();
let cache: Prefs | null = null;

function read(): Prefs {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    cache = { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    cache = { ...EMPTY };
  }
  return cache!;
}

function write(next: Prefs) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  listeners.forEach((l) => l());
}

export function updatePrefs(fn: (p: Prefs) => Partial<Prefs>) {
  const cur = read();
  write({ ...cur, ...fn(cur) });
}

export function getPrefs(): Prefs {
  return read();
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
}

export function rememberReturning(u: ReturningUser) {
  updatePrefs((p) => ({
    returning: [u, ...p.returning.filter((r) => r.email.toLowerCase() !== u.email.toLowerCase())].slice(0, 2),
  }));
}

export function forgetReturning(email: string) {
  updatePrefs((p) => ({ returning: p.returning.filter((r) => r.email.toLowerCase() !== email.toLowerCase()) }));
}

export function getSessionKey(): string {
  if (typeof window === "undefined") return "";
  let k = sessionStorage.getItem("hostme_session");
  if (!k) {
    k = crypto.randomUUID();
    sessionStorage.setItem("hostme_session", k);
  }
  return k;
}

/** Best-effort shortcut to the user's webmail inbox, never showing the address. */
export function inboxUrl(email: string | null | undefined): string {
  const domain = (email || "").split("@")[1]?.toLowerCase() || "";
  if (/gmail|googlemail/.test(domain)) return "https://mail.google.com/mail/u/0/#inbox";
  if (/hotmail|outlook|live\.|msn/.test(domain)) return "https://outlook.live.com/mail/0/inbox";
  if (/yahoo|ymail/.test(domain)) return "https://mail.yahoo.com/";
  if (/icloud|me\.com|mac\.com/.test(domain)) return "https://www.icloud.com/mail";
  if (/proton/.test(domain)) return "https://mail.proton.me/u/0/inbox";
  if (/aol/.test(domain)) return "https://mail.aol.com/";
  if (/gmx/.test(domain)) return "https://www.gmx.com/";
  if (/zoho/.test(domain)) return "https://mail.zoho.com/";
  if (/yandex/.test(domain)) return "https://mail.yandex.com/";
  return domain ? `https://${domain.startsWith("mail.") ? domain : "mail." + domain}` : "mailto:";
}

// Cross-component signals (open the Start a Host form, open search).
export const START_EVENT = "hostme:start";
export const SEARCH_EVENT = "hostme:search";
export const PREFILL_KEY = "hostme_prefill_email";

export function requestStartHost(email?: string) {
  if (email) sessionStorage.setItem(PREFILL_KEY, email);
  window.dispatchEvent(new CustomEvent(START_EVENT, { detail: { email } }));
}

export function requestSearch() {
  window.dispatchEvent(new CustomEvent(SEARCH_EVENT));
}
