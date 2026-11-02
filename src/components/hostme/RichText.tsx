import { Fragment, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  Link2,
  List,
  Palette,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { bulletLines, parseRich, TEXT_COLORS, wrapSelection, type RichNode, type TextColor, type TextSize, type TextStyle } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

const SIZE_CLASS: Record<TextSize, string> = {
  sm: "text-sm",
  lg: "text-xl leading-snug",
  xl: "font-display text-3xl leading-tight",
};
const STYLE_CLASS: Record<TextStyle, string> = {
  i: "italic",
  u: "underline underline-offset-4",
  s: "line-through",
  hl: "rounded bg-gold-soft px-1",
};
const ALIGN_CLASS = { left: "text-left", center: "text-center", right: "text-right" } as const;
const COLOR_CLASS: Record<TextColor, string> = {
  gold: "text-gold",
  purple: "text-suggest",
  red: "text-destructive",
  green: "text-success",
  blue: "text-ink-blue",
  pink: "text-ink-pink",
  gray: "text-muted-foreground",
};
const SWATCH_CLASS: Record<TextColor, string> = {
  gold: "bg-gold",
  purple: "bg-suggest",
  red: "bg-destructive",
  green: "bg-success",
  blue: "bg-ink-blue",
  pink: "bg-ink-pink",
  gray: "bg-muted-foreground",
};

function renderNodes(nodes: RichNode[]): React.ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "text":
        return <Fragment key={i}>{n.text}</Fragment>;
      case "bold":
        return <strong key={i} className="font-bold">{renderNodes(n.children)}</strong>;
      case "size":
        return <span key={i} className={SIZE_CLASS[n.size]}>{renderNodes(n.children)}</span>;
      case "style":
        return <span key={i} className={STYLE_CLASS[n.style]}>{renderNodes(n.children)}</span>;
      case "align":
        return <span key={i} className={cn("block", ALIGN_CLASS[n.align])}>{renderNodes(n.children)}</span>;
      case "color":
        return <span key={i} className={COLOR_CLASS[n.color]}>{renderNodes(n.children)}</span>;
      case "link":
        return (
          <a key={i} href={n.href} target="_blank" rel="noopener noreferrer nofollow" className="text-suggest underline underline-offset-4">
            {renderNodes(n.children)}
          </a>
        );
      case "quote":
        return <span key={i} className="block border-l-2 border-gold pl-3 italic text-foreground/80">{renderNodes(n.children)}</span>;
    }
  });
}

export function RichText({ text, className }: { text: string; className?: string }) {
  return <div className={cn("whitespace-pre-line leading-relaxed", className)}>{renderNodes(parseRich(text))}</div>;
}

type Tool = { label: string; icon: React.ReactNode } & ({ open: string; close: string } | { action: "bullet" | "link" | "palette" });

const TOOLS: Tool[] = [
  { label: "Bold", open: "**", close: "**", icon: <Bold className="h-4 w-4" /> },
  { label: "Italic", open: "[i]", close: "[/i]", icon: <Italic className="h-4 w-4" /> },
  { label: "Underline", open: "[u]", close: "[/u]", icon: <Underline className="h-4 w-4" /> },
  { label: "Strikethrough", open: "[s]", close: "[/s]", icon: <Strikethrough className="h-4 w-4" /> },
  { label: "Highlight", open: "[hl]", close: "[/hl]", icon: <Highlighter className="h-4 w-4" /> },
  { label: "Small text", open: "[sm]", close: "[/sm]", icon: <span className="text-[11px] font-semibold">A</span> },
  { label: "Large text", open: "[lg]", close: "[/lg]", icon: <span className="text-base font-semibold">A</span> },
  { label: "Extra large text", open: "[xl]", close: "[/xl]", icon: <span className="text-xl font-bold leading-none">A</span> },
  { label: "Align left", open: "[left]", close: "[/left]", icon: <AlignLeft className="h-4 w-4" /> },
  { label: "Align center", open: "[center]", close: "[/center]", icon: <AlignCenter className="h-4 w-4" /> },
  { label: "Align right", open: "[right]", close: "[/right]", icon: <AlignRight className="h-4 w-4" /> },
  { label: "Text color", action: "palette", icon: <Palette className="h-4 w-4" /> },
  { label: "Link", action: "link", icon: <Link2 className="h-4 w-4" /> },
  { label: "Bullet list", action: "bullet", icon: <List className="h-4 w-4" /> },
  { label: "Quote", open: "[quote]", close: "[/quote]", icon: <Quote className="h-4 w-4" /> },
];

const btn = "press inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent";

/** Body editor: formatting buttons wrap the selected words; a live preview shows the result. */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [palette, setPalette] = useState(false);

  const range = () => {
    const el = ref.current;
    return { el, start: el?.selectionStart ?? value.length, end: el?.selectionEnd ?? value.length };
  };
  const commit = (next: { value: string; start: number; end: number }, el: HTMLTextAreaElement | null) => {
    onChange(next.value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.start, next.end);
    });
  };
  const wrap = (open: string, close: string) => {
    const { el, start, end } = range();
    commit(wrapSelection(value, start, end, open, close), el);
  };

  const run = (t: Tool) => {
    if ("open" in t) return wrap(t.open, t.close);
    if (t.action === "palette") return setPalette((v) => !v);
    if (t.action === "bullet") {
      const { el, start, end } = range();
      return commit(bulletLines(value, start, end), el);
    }
    const url = window.prompt("Link address (https://…)", "https://")?.trim();
    if (!url || !/^https?:\/\/[^\s"'<>\]]+$/.test(url)) return;
    wrap(`[url=${url}]`, "[/url]");
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1 rounded-lg border bg-card p-1">
        <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Text formatting">
          {TOOLS.map((t) => (
            <button
              key={t.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(t)}
              className={cn(btn, "action" in t && t.action === "palette" && palette && "bg-accent text-gold")}
              aria-label={t.label}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>
        {palette && (
          <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1" aria-label="Colors">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  wrap(`[color=${c}]`, "[/color]");
                  setPalette(false);
                }}
                className={cn("press h-7 w-7 rounded-full ring-1 ring-border", SWATCH_CLASS[c])}
                aria-label={`Color ${c}`}
                title={c}
              />
            ))}
          </div>
        )}
      </div>
      <Textarea ref={ref} rows={10} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Page text" />
      {value.trim() && (
        <div className="rounded-lg border border-dashed p-3">
          <RichText text={value} />
        </div>
      )}
    </div>
  );
}
