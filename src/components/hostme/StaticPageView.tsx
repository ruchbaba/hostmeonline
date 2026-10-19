import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-me";
import { slugify } from "@/lib/format";
import type { StaticPageRow } from "@/lib/public.functions";
import { Frame169 } from "./Banner";
import { FooterSearch } from "./FooterSearch";

export function StaticPageView({ initial }: { initial: StaticPageRow }) {
  const { me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const page = useQuery({
    queryKey: ["static", initial.key],
    initialData: initial,
    queryFn: async () => {
      const { data } = await supabase.from("static_pages").select("*").eq("key", initial.key).maybeSingle();
      return (data as StaticPageRow) ?? initial;
    },
  }).data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(page);

  const save = async () => {
    const slug = draft.title !== page.title ? slugify(draft.title) : page.slug;
    const { error } = await supabase
      .from("static_pages")
      .update({ title: draft.title, subtitle: draft.subtitle, body: draft.body, banner1_url: draft.banner1_url, banner1_link: draft.banner1_link, banner2_url: draft.banner2_url, banner2_link: draft.banner2_link, slug })
      .eq("key", page.key);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["static", page.key] });
    setEditing(false);
    toast.success("Saved");
    if (slug !== page.slug) navigate({ to: "/$slug", params: { slug } });
  };

  const banner = (url: string, link: string) =>
    url ? (
      <a href={link || undefined} target="_blank" rel="noreferrer" className="press block">
        <Frame169 src={url} alt={page.title} />
      </a>
    ) : null;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-3 py-6">
      {editing ? (
        <div className="space-y-2">
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" />
          <Input value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} placeholder="Subtitle" />
          <Textarea rows={10} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <Input value={draft.banner1_url} onChange={(e) => setDraft({ ...draft, banner1_url: e.target.value })} placeholder="First banner image URL" />
          <Input value={draft.banner1_link} onChange={(e) => setDraft({ ...draft, banner1_link: e.target.value })} placeholder="First banner link" />
          <Input value={draft.banner2_url} onChange={(e) => setDraft({ ...draft, banner2_url: e.target.value })} placeholder="Second banner image URL" />
          <Input value={draft.banner2_link} onChange={(e) => setDraft({ ...draft, banner2_link: e.target.value })} placeholder="Second banner link" />
          <div className="flex gap-2">
            <Button variant="gold" onClick={() => void save()}>Save</Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold">{page.title}</h1>
          {page.subtitle && <p className="text-lg text-muted-foreground">{page.subtitle}</p>}
          <div className="whitespace-pre-line leading-relaxed">{page.body}</div>
          {me?.isAdmin && (
            <Button variant="outline" size="sm" onClick={() => { setDraft(page); setEditing(true); }}>
              Edit page
            </Button>
          )}
        </header>
      )}
      {banner(page.banner1_url, page.banner1_link)}
      {banner(page.banner2_url, page.banner2_link)}
      <FooterSearch />
    </main>
  );
}
