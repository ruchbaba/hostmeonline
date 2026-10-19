import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { qk, type Host } from "@/lib/api";
import { MAX_TAGS } from "@/lib/slots";
import { normalizeTag } from "@/lib/tags";

export function TagsRow({ host, isOwner }: { host: Host; isOwner: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const save = async (tags: string[]) => {
    const { error } = await supabase.from("hosts").update({ tags }).eq("id", host.id);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["host"] });
    await qc.invalidateQueries({ queryKey: qk.home });
    await qc.invalidateQueries({ queryKey: ["me"] });
  };

  const add = async () => {
    const incoming = value.split(/[\s,]+/).map(normalizeTag).filter(Boolean);
    const next = [...new Set([...host.tags, ...incoming])].slice(0, MAX_TAGS);
    setValue("");
    await save(next);
    if (next.length >= MAX_TAGS) setOpen(false);
  };

  return (
    <div className="space-y-2">
      <h1 className="font-display text-2xl font-bold leading-tight">{host.name}</h1>
      <div className="flex flex-wrap items-center gap-1.5">
        {host.tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            #{t}
            {isOwner && (
              <button aria-label={`Remove ${t}`} onClick={() => void save(host.tags.filter((x) => x !== t))} className="press -mr-1 rounded-full p-0.5 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {isOwner && host.tags.length < MAX_TAGS && (
          <button onClick={() => setOpen(true)} className="press inline-flex items-center gap-1 rounded-full border border-gold/40 px-2.5 py-0.5 text-xs text-gold hover:bg-gold-soft">
            <Plus className="h-3 w-3" /> Tags
          </button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Tags</DialogTitle>
            <DialogDescription>
              Add your topics, or let people know what you're open to (e.g., #NewsletterSwap, #DesignBarter, #OpenToCollab)
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="#OpenToCollab" />
            <Button type="submit" size="icon" aria-label="Add tag">
              <Plus />
            </Button>
          </form>
          <p className="text-right text-xs text-muted-foreground">
            {host.tags.length}/{MAX_TAGS}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
