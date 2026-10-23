import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => setTheme(readTheme()), []);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      aria-label={theme === "dark" ? "Switch to bright mode" : "Switch to dark mode"}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      className="press inline-flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-card text-gold shadow-gold hover:bg-gold-soft"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
