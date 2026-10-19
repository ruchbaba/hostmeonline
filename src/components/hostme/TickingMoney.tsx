import { useEffect, useRef, useState } from "react";

/** Animates a dollar amount upward to the latest value, down to the tenth of a cent. */
export function TickingMoney({ value, className, digits = 3 }: { value: number; className?: string; digits?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 1200);
      const v = a + (b - a) * (1 - Math.pow(1 - p, 3));
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className={className}>
      ${shown.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}
    </span>
  );
}
