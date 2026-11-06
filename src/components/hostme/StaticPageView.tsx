import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/hooks/use-me";
import { slugify } from "@/lib/format";
import type { StaticPageRow } from "@/lib/public.functions";
import { embedSlugOf } from "@/lib/embed-code";
import { RESERVED_SLUGS } from "@/lib/rich-text";
import { Frame169 } from "./Banner";
import { LiveHostBanner } from "./LiveHostBanner";
import { FooterSearch } from "./FooterSearch";
import { GuideBannerField } from "./GuideBannerField";
import { GuideBoard } from "./GuideBoard";
import { RichText, RichTextEditor } from "./RichText";

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
  const personal = !!page.host_id;
  // Personal pages open with their Host's live banner; admin guide pages with their first banner.
  const owner = useQuery({
    queryKey: ["host-of-page", page.host_id],
    enabled: personal,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("hosts").select("slug").eq("id", page.host_id!).maybeSingle();
      return data?.slug ?? null;
    },
  });
  const canEdit = !!me?.isAdmin || (personal && (me?.hosts ?? []).some((h) => h.id === page.host_id));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(page);
  const [linkTouched, setLinkTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(page);
    setLinkTouched(false);
    setEditing(true);
  };

  const setTitle = (title: string) =>
    setDraft((d) => ({ ...d, title, slug: linkTouched ? d.slug : slugify(title) }));

  const save = async () => {
    const slug = slugify(draft.slug || draft.title);
    if (RESERVED_SLUGS.includes(slug)) return toast.error(`/${slug} is already used by the app — pick another link`);
    setSaving(true);
    try {
      if (slug !== page.slug) {
        const [{ data: otherPage }, { data: host }] = await Promise.all([
          supabase.from("static_pages").select("key").or(`slug.eq.${slug},key.eq.${slug}`).neq("key", page.key).maybeSingle(),
          supabase.from("hosts").select("id").eq("slug", slug).maybeSingle(),
        ]);
        if (otherPage || host) return toast.error(`/${slug} is already taken — pick another link`);
      }
      const { error } = await supabase
        .from("static_pages")
        .update({ title: draft.title, subtitle: draft.subtitle, body: draft.body, banner1_url: draft.banner1_url, banner1_link: draft.banner1_link, banner2_url: draft.banner2_url, banner2_link: draft.banner2_link, slug })
        .eq("key", page.key);
      if (error) return toast.error(error.message);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["static", page.key] }),
        qc.invalidateQueries({ queryKey: ["slug-ssr"] }),
        qc.invalidateQueries({ queryKey: ["static-pages-menu"] }),
        ...(page.host_id ? [qc.invalidateQueries({ queryKey: ["host-page", page.host_id] })] : []),
      ]);
      setEditing(false);
      toast.success(slug !== page.slug ? `Saved — new link /${slug}` : "Saved");
      if (slug !== page.slug) navigate({ to: "/$slug", params: { slug }, replace: true });
    } finally {
      setSaving(false);
    }
  };

  const banner = (url: string, link: string) => {
    const slug = embedSlugOf(url);
    if (slug) return <LiveHostBanner slug={slug} />;
    return url ? (
      <a href={link || undefined} target="_blank" rel="noreferrer" className="press block">
        <Frame169 src={url} alt={page.title} />
      </a>
    ) : null;
  };

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-3 py-6">
      {personal ? owner.data && <LiveHostBanner slug={owner.data} /> : !editing && banner(page.banner1_url, page.banner1_link)}
      {editing ? (
        <div className="space-y-2">
          <div className="flex items-center rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
            <span className="pl-3 font-mono text-sm text-gold">/</span>
            <input
              value={draft.slug}
              onChange={(e) => {
                setLinkTouched(true);
                setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") });
              }}
              onBlur={() => setDraft((d) => ({ ...d, slug: slugify(d.slug || d.title) }))}
              placeholder="link"
              aria-label="Page link"
              className="h-9 w-full bg-transparent px-1 py-1 font-mono text-sm outline-none"
            />
          </div>
          <Input value={draft.title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
          <Input
            value={draft.subtitle}
            onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
            placeholder="Slogan"
            aria-label="Slogan"
            className="h-11 text-lg font-bold md:text-lg"
          />
          <RichTextEditor value={draft.body} onChange={(body) => setDraft((d) => ({ ...d, body }))} />
          {!personal && (
            <GuideBannerField
              label="First banner"
              url={draft.banner1_url}
              link={draft.banner1_link}
              onChange={(v) => setDraft((d) => ({ ...d, banner1_url: v.url, banner1_link: v.link }))}
            />
          )}
          <GuideBannerField
            label={personal ? "Shared banner" : "Second banner"}
            url={draft.banner2_url}
            link={draft.banner2_link}
            onChange={(v) => setDraft((d) => ({ ...d, banner2_url: v.url, banner2_link: v.link }))}
          />
          <div className="flex gap-2">
            <Button variant="gold" disabled={saving} onClick={() => void save()}>Save</Button>
            <Button variant="outline" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <header className="space-y-3">
          <h1 className="font-display text-3xl font-bold">{page.title}</h1>
          {page.subtitle && <p className="text-xl font-bold leading-snug sm:text-2xl">{page.subtitle}</p>}
          <RichText text={page.body} />
          {canEdit && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              Edit page
            </Button>
          )}
        </header>
      )}
      <GuideBoard pageKey={page.key} />
      {personal ? owner.data && <LiveHostBanner slug={owner.data} /> : !editing && banner(page.banner2_url, page.banner2_link)}
      <FooterSearch />
    </main>
  );
}
