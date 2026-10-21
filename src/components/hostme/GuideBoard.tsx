import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-me";
import { Frame169 } from "./Banner";

const MAX = 600;

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

/** Community micro-board on guide pages: hosts post short notes as their acting Host page. */
export function GuideBoard({ pageKey }: { pageKey: string }) {
  const { user, acting, me } = useMe();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const qKey = ["board", pageKey];

  const posts = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("board_posts")
        .select("id, body, link, created_at, host_id, hosts(slug, name, image_url, is_home)")
        .eq("page_key", pageKey)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`board-${pageKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "board_posts", filter: `page_key=eq.${pageKey}` }, () => {
        void qc.invalidateQueries({ queryKey: ["board", pageKey] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [pageKey, qc]);

  const post = async () => {
    if (!acting) return;
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    const { error } = await supabase.from("board_posts").insert({ page_key: pageKey, host_id: acting.id, body: text.slice(0, MAX) });
    setBusy(false);
    if (error) return toast.error("Could not post");
    setBody("");
    await qc.invalidateQueries({ queryKey: qKey });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("board_posts").delete().eq("id", id);
    if (error) return toast.error("Could not delete");
    await qc.invalidateQueries({ queryKey: qKey });
  };

  const ownIds = new Set((me?.hosts ?? []).map((h) => h.id));

  return (
    <section className="space-y-3" aria-label="Community board">
      <h2 className="font-display text-lg font-bold">Community board</h2>
      {user && acting ? (
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">
            Posting as <span className="text-gold">{acting.name}</span>
          </p>
          <Textarea
            rows={3}
            maxLength={MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share a tip, a story or a question…"
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {body.length}/{MAX}
            </p>
            <Button variant="gold" size="sm" disabled={busy || !body.trim()} onClick={() => void post()} aria-label="Post">
              <Send /> Post
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
          {user ? "Start a Host page to post on the board." : "Log in from the top-right menu to post on the board."}
        </p>
      )}
      {posts.data?.length === 0 && <p className="text-sm text-muted-foreground">No posts yet — be the first.</p>}
      <ul className="space-y-2">
        {(posts.data ?? []).map((p) => {
          const h = p.hosts as { slug: string; name: string; image_url: string; is_home: boolean } | null;
          return (
            <li key={p.id} className="flex gap-3 rounded-xl border bg-card p-3">
              {h && (
                <Link
                  to={h.is_home ? "/" : "/$slug"}
                  params={h.is_home ? {} : { slug: h.slug }}
                  className="press w-24 shrink-0"
                  aria-label={h.name}
                >
                  <Frame169 src={h.image_url} alt={h.name} className="rounded-lg" />
                </Link>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex items-center gap-2 text-xs">
                  <span className="truncate font-semibold text-gold">{h?.name ?? "Host"}</span>
                  <span className="text-muted-foreground">{ago(p.created_at)}</span>
                  {(ownIds.has(p.host_id) || me?.isAdmin) && (
                    <button onClick={() => void remove(p.id)} className="press ml-auto text-muted-foreground hover:text-destructive" aria-label="Delete post">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </p>
                <p className="whitespace-pre-line break-words text-sm">{p.body}</p>
                {p.link && (
                  <a href={p.link} target="_blank" rel="noopener noreferrer nofollow" className="press inline-flex items-center gap-1 text-xs text-suggest hover:underline">
                    <ExternalLink className="h-3 w-3" /> {new URL(p.link).hostname}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
