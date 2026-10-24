/**
 * Tiny, safe markup for guide-page bodies (rendered as React nodes, never as HTML):
 *   **bold**   [sm]small[/sm]   [lg]large[/lg]   [xl]extra large[/xl]
 * Unclosed markers are kept as plain text.
 */
export type TextSize = "sm" | "lg" | "xl";
export type RichNode =
  | { type: "text"; text: string }
  | { type: "bold"; children: RichNode[] }
  | { type: "size"; size: TextSize; children: RichNode[] };

const SIZE_OPEN = /\[(sm|lg|xl)\]/;

export function parseRich(input: string): RichNode[] {
  const out: RichNode[] = [];
  let rest = input;
  const pushText = (t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last?.type === "text") last.text += t;
    else out.push({ type: "text", text: t });
  };
  while (rest) {
    const b = rest.indexOf("**");
    const sm = SIZE_OPEN.exec(rest);
    const s = sm ? sm.index : -1;
    if (b < 0 && s < 0) {
      pushText(rest);
      break;
    }
    if (b >= 0 && (s < 0 || b < s)) {
      const close = rest.indexOf("**", b + 2);
      if (close < 0) {
        pushText(rest);
        break;
      }
      pushText(rest.slice(0, b));
      out.push({ type: "bold", children: parseRich(rest.slice(b + 2, close)) });
      rest = rest.slice(close + 2);
      continue;
    }
    const size = sm![1] as TextSize;
    const openEnd = s + sm![0].length;
    const close = rest.indexOf(`[/${size}]`, openEnd);
    if (close < 0) {
      pushText(rest.slice(0, openEnd));
      rest = rest.slice(openEnd);
      continue;
    }
    pushText(rest.slice(0, s));
    out.push({ type: "size", size, children: parseRich(rest.slice(openEnd, close)) });
    rest = rest.slice(close + size.length + 3);
  }
  return out;
}

/** Wraps the selected range in markers; with no selection, inserts the markers around a placeholder. */
export function wrapSelection(value: string, start: number, end: number, open: string, close: string, placeholder = "text") {
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + open + selected + close + value.slice(end);
  const selStart = start + open.length;
  return { value: next, start: selStart, end: selStart + selected.length };
}

/** App paths a guide page link may never take. */
export const RESERVED_SLUGS = ["auth", "write", "messages", "payouts", "payment-success", "embed", "api", "index"];
