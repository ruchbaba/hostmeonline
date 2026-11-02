import { createFileRoute, Link } from "@tanstack/react-router";
import { PostBody, WriteForm, usePostsFeed } from "@/components/hostme/WriteAnything";

export const Route = createFileRoute("/write")({
  validateSearch: (s: Record<string, unknown>): { host?: string } => ({ host: typeof s.host === "string" ? s.host : undefined }),
  head: () => ({
    meta: [
      { title: "Write Anything — Hostme" },
      { name: "description", content: "Live notes and updates from Hostme creators." },
      { property: "og:title", content: "Write Anything — Hostme" },
      { property: "og:description", content: "Live notes and updates from Hostme creators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WritePage,
});

function WritePage() {
  const feed = usePostsFeed(100);
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-3 py-4">
      <WriteForm />
      <div className="space-y-3">
        {(feed.data ?? []).map((p) => (
          <Link
            key={p.host_id}
            to={p.hosts.is_home ? "/" : "/$slug"}
            params={p.hosts.is_home ? undefined : { slug: p.hosts.slug }}
            className="press block rounded-xl border bg-card p-3 hover:border-gold/40"
          >
            <PostBody image={p.hosts.image_url} name={p.hosts.is_home ? "Hostme" : p.hosts.name} body={p.body} />
          </Link>
        ))}
      </div>
    </main>
  );
}
