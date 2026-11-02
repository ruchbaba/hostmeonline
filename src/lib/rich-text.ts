/**
 * Tiny, safe markup for guide-page bodies (rendered as React nodes, never as HTML):
 *   **bold**  [i]italic[/i]  [u]underline[/u]  [s]strike[/s]  [hl]highlight[/hl]
 *   [sm]small[/sm]  [lg]large[/lg]  [xl]extra large[/xl]
 *   [left]..[/left]  [center]..[/center]  [right]..[/right]  [quote]..[/quote]
 *   [color=gold|purple|red|green|blue|pink|gray]..[/color]   [url=https://…]text[/url]
 * Unclosed or unknown markers are kept as plain text.
 */
export type TextSize = "sm" | "lg" | "xl";
export type TextStyle = "i" | "u" | "s" | "hl";
export type TextAlign = "left" | "center" | "right";
export const TEXT_COLORS = ["gold", "purple", "red", "green", "blue", "pink", "gray"] as const;
export type TextColor = (typeof TEXT_COLORS)[number];

export type RichNode =
  | { type: "text"; text: string }
  | { type: "bold"; children: RichNode[] }
  | { type: "size"; size: TextSize; children: RichNode[] }
  | { type: "style"; style: TextStyle; children: RichNode[] }
  | { type: "align"; align: TextAlign; children: RichNode[] }
  | { type: "color"; color: TextColor; children: RichNode[] }
  | { type: "link"; href: string; children: RichNode[] }
  | { type: "quote"; children: RichNode[] };

const OPEN = new RegExp(
  `\\[(b|i|u|s|hl|sm|lg|xl|left|center|right|quote|color=(?:${TEXT_COLORS.join("|")})|url=https?:\\/\\/[^\\]\\s"'<>]+)\\]`,
);

function nodeFor(tag: string, children: RichNode[]): RichNode {
  const [name, arg] = tag.includes("=") ? [tag.slice(0, tag.indexOf("=")), tag.slice(tag.indexOf("=") + 1)] : [tag, ""];
  switch (name) {
    case "b":
      return { type: "bold", children };
    case "sm":
    case "lg":
    case "xl":
      return { type: "size", size: name, children };
    case "i":
    case "u":
    case "s":
    case "hl":
      return { type: "style", style: name, children };
    case "left":
    case "center":
    case "right":
      return { type: "align", align: name, children };
    case "color":
      return { type: "color", color: arg as TextColor, children };
    case "url":
      return { type: "link", href: arg, children };
    default:
      return { type: "quote", children };
  }
}

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
    const m = OPEN.exec(rest);
    const s = m ? m.index : -1;
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
    const tag = m![1]!;
    const name = tag.split("=")[0]!;
    const openEnd = s + m![0].length;
    const closeTag = `[/${name}]`;
    const close = rest.indexOf(closeTag, openEnd);
    if (close < 0) {
      pushText(rest.slice(0, openEnd));
      rest = rest.slice(openEnd);
      continue;
    }
    pushText(rest.slice(0, s));
    out.push(nodeFor(tag, parseRich(rest.slice(openEnd, close))));
    rest = rest.slice(close + closeTag.length);
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

/** Puts a bullet ("• ") at the start of every selected line (or the current line). */
export function bulletLines(value: string, start: number, end: number) {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const block = value.slice(lineStart, end);
  const bulleted = block
    .split("\n")
    .map((l) => (l.startsWith("• ") ? l : `• ${l}`))
    .join("\n");
  const next = value.slice(0, lineStart) + bulleted + value.slice(end);
  return { value: next, start: lineStart, end: lineStart + bulleted.length };
}

/** Removes every formatting marker, leaving plain words (for previews and descriptions). */
export function plainText(input: string): string {
  const walk = (nodes: RichNode[]): string => nodes.map((n) => (n.type === "text" ? n.text : walk(n.children))).join("");
  return walk(parseRich(input));
}

/** App paths a guide page link may never take. */
export const RESERVED_SLUGS = ["auth", "write", "messages", "payouts", "payment-success", "embed", "api", "index"];
