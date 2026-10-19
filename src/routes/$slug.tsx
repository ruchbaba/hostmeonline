import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { resolveSlug } from "@/lib/public.functions";
import { HostPageView } from "@/components/hostme/HostPageView";
import { StaticPageView } from "@/components/hostme/StaticPageView";

const slugQuery = (slug: string) =>
  queryOptions({ queryKey: ["slug-ssr", slug], queryFn: () => resolveSlug({ data: { slug } }), staleTime: 30_000 });

export const Route = createFileRoute("/$slug")({
  validateSearch: (s: Record<string, unknown>): { ref?: string; src?: string } => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
    src: typeof s.src === "string" ? s.src : undefined,
  }),
  loaderDeps: ({ search }) => ({ ref: search.ref, src: search.src }),
  loader: async ({ context, params, deps }) => {
    const res = await context.queryClient.ensureQueryData(slugQuery(params.slug));
    if (res.kind === "none") throw notFound();
    if (res.kind === "host" && res.host?.is_home) throw redirect({ to: "/", search: { ref: deps.ref, src: deps.src } });
    return res;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Unavailable — Hostme" }, { name: "robots", content: "noindex" }] };
    }
    const title = loaderData.kind === "host" ? `${loaderData.host!.name} on Hostme` : `${loaderData.page!.title} — Hostme`;
    const desc =
      loaderData.kind === "host"
        ? `${loaderData.host!.name}${loaderData.host!.tags.length ? " · #" + loaderData.host!.tags.slice(0, 5).join(" #") : ""} — Every banner is a window to somewhere.`
        : loaderData.page!.subtitle || "Hostme guide";
    const img = /^https:\/\//.test(loaderData.ogImage) ? loaderData.ogImage : "";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: loaderData.kind === "host" ? "profile" : "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(img
          ? [
              { property: "og:image", content: img },
              { property: "og:image:width", content: "1200" },
              { property: "og:image:height", content: "675" },
              { name: "twitter:image", content: img },
            ]
          : []),
      ],
    };
  },
  component: SlugPage,
});

function SlugPage() {
  const { slug } = Route.useParams();
  const { ref, src } = Route.useSearch();
  const { data } = useSuspenseQuery(slugQuery(slug));
  if (data.kind === "page" && data.page) return <StaticPageView initial={data.page} />;
  if (data.kind === "host" && data.host) return <HostPageView key={data.host.id} initial={data.host} refId={ref} src={src} />;
  return null;
}
