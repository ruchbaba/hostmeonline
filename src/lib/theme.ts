export type Theme = "dark" | "light";
const KEY = "hostme-theme";

export function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return localStorage.getItem(KEY) === "light" ? "light" : "dark";
}

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.toggle("dark", t === "dark");
  el.classList.toggle("light", t === "light");
  localStorage.setItem(KEY, t);
  window.dispatchEvent(new CustomEvent("hostme-theme", { detail: t }));
}
