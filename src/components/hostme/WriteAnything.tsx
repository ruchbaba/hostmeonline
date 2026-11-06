import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { useRotating } from "@/hooks/use-rotating";
import { qk, type Host } from "@/lib/api";
import { requestStartHost } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { Frame169 } from "./Banner";

export interface FeedPost {
  host_id: string;
  body: string;
  created_at: string;
  hosts: Pick<Host, "id" | "slug" | "name" | "image_url" | "views" | "is_home">;
}

export const WRITE_TIP = "What are you working on today? (Tip: Mention if you're looking to swap traffic or collaborate with a partner!)";

export function usePostsFeed(limit = 40) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("posts-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => void qc.invalidateQueries({ queryKey: qk.posts }))
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);
  return useQuery({
    queryKey: [...qk.posts, limit],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("host_id, body, created_at, hosts!inner(id, slug, name, image_url, views, is_home)")
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []) as unknown as FeedPost[];
    },
  });
}

export function usePost(hostId: string) {
  return useQuery({
    queryKey: qk.post(hostId),
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("*").eq("host_id", hostId).maybeSingle();
      return data;
    },
  });
}

export const WRITE_MAX = 500;
const HEAD_CHARS = 90; // about 2-3 lines beside the small banner

export function splitBody(body: string): [string, string] {
  if (body.length <= HEAD_CHARS) return [body, ""];
  const nl = body.indexOf("\n");
  if (nl > 0 && nl <= HEAD_CHARS) return [body.slice(0, nl), body.slice(nl + 1).trimStart()];
  const cut = body.lastIndexOf(" ", HEAD_CHARS);
  const i = cut > 40 ? cut : HEAD_CHARS;
  return [body.slice(0, i), body.slice(i).trimStart()];
}

/** Small banner + first lines beside it, the rest below. */
export function PostBody({ image, name, body, className }: { image: string; name: string; body: string; className?: string }) {
  const [head, tail] = splitBody(body);
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-3">
        <Frame169 src={image} alt={name} className="w-20 shrink-0 rounded-lg sm:w-24" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gold">{name}</p>
          <p className="whitespace-pre-line text-sm leading-relaxed">{head}</p>
        </div>
      </div>
      {tail && <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{tail}</p>}
    </div>
  );
}

export function WriteBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold">
      <PenLine className="h-3 w-3" /> Write Anything
    </span>
  );
}

/** A host's single active status (host page / Hostme owner card). Text only — the banner is already above it. */
export function StatusCard({ host, isOwner, showEmpty = true }: { host: Host; isOwner: boolean; showEmpty?: boolean }) {
  const post = usePost(host.id);
  if (!post.data && !(isOwner && showEmpty)) return null;
  return (
    <Link to="/write" search={{ host: host.slug }} className="press block rounded-xl border bg-card p-3 hover:border-gold/40">
      <div className="mb-2">
        <WriteBadge />
      </div>
      {post.data ? (
        <p className="whitespace-pre-line text-sm leading-relaxed">{post.data.body}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{WRITE_TIP}</p>
      )}
    </Link>
  );
}

/** Rotating queue of the latest posts (each stays ~6s). */
export function LiveTicker({ excludeHostId }: { excludeHostId?: string }) {
  const feed = usePostsFeed(20);
  const items = (feed.data ?? []).filter((p) => p.host_id !== excludeHostId);
  const { item, index } = useRotating(items, 6000);
  if (!item) return null;
  return (
    <Link to="/write" className="press block rounded-xl border border-gold/20 bg-card p-3 hover:border-gold/40">
      <div className="mb-2">
        <WriteBadge />
      </div>
      <div key={item.host_id + index} className="hm-fade-in">
        <PostBody image={item.hosts.image_url} name={item.hosts.is_home ? "Hostme" : item.hosts.name} body={item.body} />
      </div>
    </Link>
  );
}

export function WriteForm() {
  const { user, acting } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user || !acting) {
    return (
      <div className="rounded-xl border bg-card p-4 text-center">
        <p className="mb-3 text-sm text-muted-foreground">{WRITE_TIP}</p>
        <Button
          variant="gold"
          onClick={() => {
            requestStartHost();
            navigate({ to: "/" });
          }}
        >
          Start a Host to write
        </Button>
      </div>
    );
  }
  return (
    <form
      className="space-y-2 rounded-xl border bg-card p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setBusy(true);
        const { error } = await supabase.from("posts").upsert({ host_id: acting.id, body: body.trim() });
        setBusy(false);
        if (error) return toast.error(error.message);
        setBody("");
        toast.success("Posted");
        await qc.invalidateQueries({ queryKey: qk.posts });
        await qc.invalidateQueries({ queryKey: qk.post(acting.id) });
      }}
    >
      <Textarea rows={3} maxLength={WRITE_MAX} value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Speak anything, ${acting.is_home ? "Hostme" : acting.name}…`} />
      <p className="text-xs text-muted-foreground">{WRITE_TIP}</p>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          A new post replaces your previous one. <span className="tabular-nums">{body.length}/{WRITE_MAX}</span>
        </span>
        <Button type="submit" variant="gold" size="sm" disabled={busy || !body.trim()}>
          <Send /> Post
        </Button>
      </div>
    </form>
  );
}
