import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { qk, type Host } from "@/lib/api";
import { MAX_TAGS } from "@/lib/slots";
import { normalizeTag } from "@/lib/tags";
import { currentPlace } from "@/lib/location";
import { cn } from "@/lib/utils";

/** Owner-only dot before the tags: red = hidden from near-me search, green = findable nearby. */
function LocationDot({ host }: { host: Host }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = ["host-location", host.id];
  const loc = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase.from("host_locations").select("city, region, country").eq("host_id", host.id).maybeSingle();
      return data;
    },
  });
  const on = !!loc.data;

  const allow = async () => {
    setBusy(true);
    try {
      const p = await currentPlace();
      const { error } = await supabase.rpc("set_host_location", {
        p_host: host.id,
        p_lat: p.lat,
        p_lng: p.lng,
        p_city: p.city,
        p_region: p.region,
        p_country: p.country,
      });
      if (error) throw new Error("Could not save your location");
      await qc.invalidateQueries({ queryKey: key });
      setOpen(false);
      toast.success("Near-me users can now find this page");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get your location");
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("clear_host_location", { p_host: host.id });
    setBusy(false);
    if (error) return toast.error("Could not turn it off");
    await qc.invalidateQueries({ queryKey: key });
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={on ? "Found by near-me search: on" : "Found by near-me search: off"}
        aria-pressed={on}
        className="press inline-flex h-6 w-6 items-center justify-center rounded-full"
      >
        <span className={cn("h-3 w-3 rounded-full ring-2 ring-background", on ? "bg-success" : "bg-destructive")} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2 font-display">
              <MapPin className="h-5 w-5 text-gold" /> Near me
            </DialogTitle>
            <DialogDescription>
              {on
                ? `Near-me users can find this page${loc.data?.city ? ` around ${loc.data.city}` : ""}.`
                : "Allow your location to be found by near-me users in the smart search?"}
            </DialogDescription>
          </DialogHeader>
          {on ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => void stop()}>
                Turn off
              </Button>
              <Button variant="gold" className="flex-1" disabled={busy} onClick={() => void allow()}>
                {busy ? <Loader2 className="animate-spin" /> : <MapPin />} Update
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Not now
              </Button>
              <Button variant="gold" className="flex-1" disabled={busy} onClick={() => void allow()}>
                {busy ? <Loader2 className="animate-spin" /> : <MapPin />} Allow
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

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
        {isOwner && !host.is_home && <LocationDot host={host} />}
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
