import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/messages")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Messages — Hostme" },
      { name: "description", content: "Your private Hostme messages." },
      { property: "og:title", content: "Messages — Hostme" },
      { property: "og:description", content: "Your private Hostme messages." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user, me } = useMe();
  const ids = (me?.hosts ?? []).map((h) => h.id);
  const q = useQuery({
    queryKey: ["messages", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`to_host_id.in.(${ids.join(",")}),from_host_id.in.(${ids.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(100);
      const unread = (data ?? []).filter((m) => m.read_at === null && ids.includes(m.to_host_id ?? "")).map((m) => m.id);
      if (unread.length) await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unread);
      const other = [...new Set((data ?? []).flatMap((m) => [m.from_host_id, m.to_host_id]).filter(Boolean) as string[])];
      const { data: hosts } = other.length ? await supabase.from("hosts").select("id, name").in("id", other) : { data: [] };
      const names = Object.fromEntries((hosts ?? []).map((h) => [h.id, h.name]));
      return (data ?? []).map((m) => ({ ...m, fromName: m.from_host_id ? names[m.from_host_id] ?? "Host" : "A visitor", toName: m.to_host_id ? names[m.to_host_id] ?? "Host" : "A visitor" }));
    },
  });
  if (!user) return <main className="mx-auto max-w-2xl px-3 py-10 text-center text-muted-foreground">Log in from the top-right menu to see your messages.</main>;
  return (
    <main className="mx-auto max-w-2xl space-y-3 px-3 py-4">
      <h1 className="font-display text-2xl font-bold">Messages</h1>
      {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
      {(q.data ?? []).map((m) => (
        <div key={m.id} className="rounded-xl border bg-card p-3">
          <p className="text-xs text-gold">
            {m.fromName} → {m.toName}
          </p>
          <p className="whitespace-pre-line text-sm">{m.body}</p>
        </div>
      ))}
    </main>
  );
}
