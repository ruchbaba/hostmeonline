import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-me";
import { qk } from "@/lib/api";
import { groupThreads, replyTarget, type Thread } from "@/lib/threads";
import { cn } from "@/lib/utils";
import { Frame169 } from "@/components/hostme/Banner";

export const Route = createFileRoute("/messages")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Messages — Hostme" },
      { name: "description", content: "Your private Hostme messages." },
      { property: "og:title", content: "Messages — Hostme" },
      { property: "og:description", content: "Your private Hostme messages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

type Row = {
  id: string;
  from_host_id: string | null;
  from_messenger_id: string | null;
  to_host_id: string | null;
  to_messenger_id: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
};
type HostInfo = { id: string; name: string; image_url: string };

function MessagesPage() {
  const { user, me } = useMe();
  const ids = (me?.hosts ?? []).map((h) => h.id);
  const q = useQuery({
    queryKey: ["messages", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, from_host_id, from_messenger_id, to_host_id, to_messenger_id, body, created_at, read_at")
        .or(`to_host_id.in.(${ids.join(",")}),from_host_id.in.(${ids.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(300);
      const rows = (data ?? []) as Row[];
      const other = [...new Set(rows.flatMap((m) => [m.from_host_id, m.to_host_id]).filter(Boolean) as string[])];
      const { data: hosts } = other.length ? await supabase.from("hosts").select("id, name, image_url").in("id", other) : { data: [] };
      const byId: Record<string, HostInfo> = Object.fromEntries(((hosts ?? []) as HostInfo[]).map((h) => [h.id, h]));
      return { threads: groupThreads(rows, ids), hosts: byId };
    },
  });

  if (!user) return <main className="mx-auto max-w-2xl px-3 py-10 text-center text-muted-foreground">Log in from the top-right menu to see your messages.</main>;
  const threads = q.data?.threads ?? [];
  return (
    <main className="mx-auto max-w-2xl space-y-3 px-3 py-4">
      <h1 className="font-display text-2xl font-bold">Messages</h1>
      {q.isSuccess && threads.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
      {threads.map((t) => (
        <ThreadCard key={t.key} thread={t} hosts={q.data!.hosts} />
      ))}
    </main>
  );
}

function ThreadCard({ thread, hosts }: { thread: Thread<Row>; hosts: Record<string, HostInfo> }) {
  const { me, user } = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(thread.unread > 0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const myHost = me?.hosts.find((h) => h.id === thread.myHostId);
  const other = thread.other.kind === "host" ? hosts[thread.other.id] : null;
  const otherName = other?.name ?? (thread.other.kind === "messenger" ? "A visitor" : "Host");
  const last = thread.messages[thread.messages.length - 1];

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && thread.unread > 0) {
      const unreadIds = thread.messages.filter((m) => m.read_at === null && m.to_host_id === thread.myHostId).map((m) => m.id);
      if (unreadIds.length) {
        await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
        void qc.invalidateQueries({ queryKey: ["messages"] });
        void qc.invalidateQueries({ queryKey: qk.unread(user?.id ?? null) });
      }
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const t = replyTarget(thread);
    const { data, error } = await supabase.rpc("send_message", {
      p_from: t.p_from,
      p_to_host: t.p_to_host as unknown as string,
      p_to_messenger: t.p_to_messenger as unknown as string,
      p_body: body,
    });
    setBusy(false);
    if (error || data !== "ok") return toast.error("Could not send");
    setText("");
    await qc.invalidateQueries({ queryKey: ["messages"] });
  };

  return (
    <div className={cn("rounded-xl border bg-card", thread.unread > 0 && "border-gold/50")}>
      <button onClick={() => void toggle()} className="press flex w-full items-center gap-3 p-3 text-left">
        <div className="w-20 shrink-0">
          <Frame169 src={other?.image_url} alt={otherName} className="rounded-lg" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm">
            <span className="truncate font-semibold">{otherName}</span>
            {thread.unread > 0 && <span className="rounded-full bg-gold px-2 text-xs font-bold text-gold-foreground">{thread.unread}</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            to <span className="text-gold">{myHost?.name ?? "my page"}</span> · {last?.body}
          </p>
        </div>
      </button>
      {open && (
        <div className="space-y-2 border-t p-3">
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {thread.messages.map((m) => {
              const mine = m.from_host_id === thread.myHostId;
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <p
                    className={cn(
                      "max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3 py-2 text-sm",
                      mine ? "bg-gold-soft text-foreground" : "bg-muted",
                    )}
                  >
                    {m.body}
                    <span className="mt-1 block text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                  </p>
                </div>
              );
            })}
          </div>
          <div className="flex items-end gap-2">
            <Textarea rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Reply as ${myHost?.name ?? "my page"}…`} />
            <Button variant="gold" size="icon" disabled={busy || !text.trim()} onClick={() => void send()} aria-label="Send reply">
              <Send />
            </Button>
          </div>
          {thread.other.kind === "messenger" && (
            <p className="text-[11px] text-muted-foreground">Visitors will get your reply by email — email delivery is coming soon.</p>
          )}
        </div>
      )}
    </div>
  );
}
