import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/api";
import { useMe } from "./use-me";

export function useUnread() {
  const { user, me } = useMe();
  const qc = useQueryClient();
  const ids = (me?.hosts ?? []).map((h) => h.id);
  const q = useQuery({
    queryKey: [...qk.unread(user?.id ?? null), ids.join(",")],
    enabled: !!user && ids.length > 0,
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("to_host_id", ids)
        .is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`unread-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void qc.invalidateQueries({ queryKey: qk.unread(user.id) });
        void qc.invalidateQueries({ queryKey: ["messages"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, qc]);

  return q.data ?? 0;
}
