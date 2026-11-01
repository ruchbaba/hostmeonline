import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Host } from "@/lib/api";
import { qk } from "@/lib/api";
import { syncReturningName, usePrefs } from "@/lib/prefs";

export interface MeData {
  email: string;
  isAdmin: boolean;
  extraPages: number;
  giftClaimed: boolean;
  hosts: Host[]; // owned, creation order (home first for admin)
  balances: Record<string, number>;
  quota: number; // allowed non-home pages
  ownedPages: number; // non-home pages
}

interface MeCtx {
  ready: boolean;
  user: User | null;
  me: MeData | null;
  /** Host the user acts as (locked page, else selected, else first owned). */
  acting: Host | null;
  /** Owned hosts with the top (acting) page first, others in creation order. */
  orderedHosts: Host[];
  totalBalance: number;
  isOwnerView: (host: Pick<Host, "id" | "owner_id"> | null | undefined) => boolean;
  refresh: () => void;
}

const Ctx = createContext<MeCtx | null>(null);

async function loadMe(user: User): Promise<MeData> {
  const [acc, hosts, roles] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("hosts").select("*").eq("owner_id", user.id).order("is_home", { ascending: false }).order("created_at"),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const list = (hosts.data ?? []) as Host[];
  const ids = list.map((h) => h.id);
  const bal = ids.length
    ? await supabase.from("host_balances").select("host_id, balance_usd").in("host_id", ids)
    : { data: [] as { host_id: string; balance_usd: number }[] };
  const balances: Record<string, number> = {};
  (bal.data ?? []).forEach((b) => (balances[b.host_id] = Number(b.balance_usd)));
  const extra = acc.data?.extra_pages_purchased ?? 0;
  return {
    email: acc.data?.email ?? user.email ?? "",
    isAdmin: (roles.data ?? []).some((r) => r.role === "admin"),
    extraPages: extra,
    giftClaimed: acc.data?.gift_claimed ?? false,
    hosts: list,
    balances,
    quota: 1 + extra,
    ownedPages: list.filter((h) => !h.is_home).length,
  };
}

export function MeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const prefs = usePrefs();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setUser(session?.user ?? null);
        setReady(true);
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") void qc.invalidateQueries();
    });
    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const meQ = useQuery({
    queryKey: qk.me(user?.id ?? null),
    queryFn: () => loadMe(user!),
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Remembered "Welcome back" entries always carry the first-created page's name.
  useEffect(() => {
    const first = meQ.data?.hosts.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (user?.email && first) syncReturningName(user.email, first.is_home ? "Hostme" : first.name, first.slug);
  }, [meQ.data, user?.email]);

  const value = useMemo<MeCtx>(() => {
    const me = user ? (meQ.data ?? null) : null;
    const hosts = me?.hosts ?? [];
    const byId = (id: string | null) => (id ? hosts.find((h) => h.id === id) ?? null : null);
    const locked = hosts.length > 1 ? byId(prefs.lockedHostId) : null;
    const acting = locked ?? byId(prefs.selectedHostId) ?? hosts[0] ?? null;
    const orderedHosts = acting ? [acting, ...hosts.filter((h) => h.id !== acting.id)] : hosts;
    const totalBalance = Object.values(me?.balances ?? {}).reduce((a, b) => a + b, 0);
    return {
      ready,
      user,
      me,
      acting,
      orderedHosts,
      totalBalance,
      isOwnerView: (host) => {
        if (!host || !user || host.owner_id !== user.id) return false;
        if (locked && locked.id !== host.id) return false;
        return true;
      },
      refresh: () => void qc.invalidateQueries({ queryKey: qk.me(user?.id ?? null) }),
    };
  }, [user, ready, meQ.data, prefs.lockedHostId, prefs.selectedHostId, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMe(): MeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMe must be used inside MeProvider");
  return v;
}
