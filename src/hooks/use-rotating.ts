import { useEffect, useState } from "react";

/** Cycles through items every `ms`. Returns the current item and index. */
export function useRotating<T>(items: T[], ms = 3500) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setI((v) => (v + 1) % items.length), ms);
    return () => clearInterval(t);
  }, [items.length, ms]);
  const idx = items.length ? i % items.length : 0;
  return { item: items[idx], index: idx };
}

export const NAME_PROMPTS = [
  "What good will you promote?",
  "Your Brand, Project, or Passion",
  "What are you sharing with the world today?",
  "Your Creator Name or Business",
  "What traffic are you growing?",
];
