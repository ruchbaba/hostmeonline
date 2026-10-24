import { Fragment, useRef } from "react";
import { Bold } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { parseRich, wrapSelection, type RichNode, type TextSize } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

const SIZE_CLASS: Record<TextSize, string> = {
  sm: "text-sm",
  lg: "text-xl leading-snug",
  xl: "font-display text-3xl leading-tight",
};

function renderNodes(nodes: RichNode[]): React.ReactNode {
  return nodes.map((n, i) => {
    if (n.type === "text") return <Fragment key={i}>{n.text}</Fragment>;
    if (n.type === "bold") return <strong key={i} className="font-bold">{renderNodes(n.children)}</strong>;
    return <span key={i} className={SIZE_CLASS[n.size]}>{renderNodes(n.children)}</span>;
  });
}

export function RichText({ text, className }: { text: string; className?: string }) {
  return <div className={cn("whitespace-pre-line leading-relaxed", className)}>{renderNodes(parseRich(text))}</div>;
}

const TOOLS: { label: string; open: string; close: string; icon: React.ReactNode }[] = [
  { label: "Bold", open: "**", close: "**", icon: <Bold className="h-4 w-4" /> },
  { label: "Small text", open: "[sm]", close: "[/sm]", icon: <span className="text-[11px] font-semibold">A</span> },
  { label: "Large text", open: "[lg]", close: "[/lg]", icon: <span className="text-base font-semibold">A</span> },
  { label: "Extra large text", open: "[xl]", close: "[/xl]", icon: <span className="text-xl font-bold leading-none">A</span> },
];

/** Body editor with Bold + size buttons that wrap the selected words, and a live preview. */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const apply = (open: string, close: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = wrapSelection(value, start, end, open, close);
    onChange(next.value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.start, next.end);
    });
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 rounded-lg border bg-card p-1" role="toolbar" aria-label="Text formatting">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(t.open, t.close)}
            className="press inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
            aria-label={t.label}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
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
