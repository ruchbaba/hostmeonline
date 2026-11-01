import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { rememberReturning, requestStartHost } from "@/lib/prefs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing in — Hostme" },
      { name: "description", content: "Confirming your Hostme login." },
      { property: "og:title", content: "Signing in — Hostme" },
      { property: "og:description", content: "Confirming your Hostme login." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Opening your Hostpage…");
  useEffect(() => {
    let done = false;
    const finish = async () => {
      if (done) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      done = true;
      const { data: slug } = await supabase.rpc("claim_signup");
      if (!slug) {
        requestStartHost(data.user.email ?? undefined);
        navigate({ to: "/", replace: true });
        return;
      }
      const { data: host } = await supabase.from("hosts").select("name, is_home").eq("slug", slug).maybeSingle();
      // "Welcome back" always shows the name of the first page created on this email.
      const { data: first } = await supabase
        .from("hosts")
        .select("name, slug, is_home")
        .eq("owner_id", data.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const named = first ?? host;
      if (data.user.email && named) rememberReturning({ name: named.is_home ? "Hostme" : named.name, email: data.user.email, slug: first?.slug ?? slug });
      if (host?.is_home) navigate({ to: "/", replace: true });
      else navigate({ to: "/$slug", params: { slug }, replace: true });
    };
    const { data: sub } = supabase.auth.onAuthStateChange(() => void finish());
    void finish();
    const t = setTimeout(() => !done && setMsg("This link may have expired. Request a new one from the top-right menu."), 12000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [navigate]);
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-gold" />
      <p>{msg}</p>
    </main>
  );
}
