import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getHomeHost } from "@/lib/public.functions";
import { HomeView, HERO_SLOGAN } from "@/components/hostme/HomeView";

const homeQuery = queryOptions({ queryKey: ["home-host-ssr"], queryFn: () => getHomeHost(), staleTime: 30_000 });

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { ref?: string; src?: string } => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
    src: typeof s.src === "string" ? s.src : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  head: ({ loaderData }) => {
    const img = loaderData?.ogImage && /^https:\/\//.test(loaderData.ogImage) ? loaderData.ogImage : "";
    return {
      meta: [
        { title: "Hostme — Share slots, exchange audiences" },
        { name: "description", content: HERO_SLOGAN },
        { property: "og:title", content: "Hostme — Share slots, exchange audiences" },
        { property: "og:description", content: HERO_SLOGAN },
        { property: "og:type", content: "website" },
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
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(homeQuery);
  const { ref, src } = Route.useSearch();
  if (!data.host) {
    return <main className="mx-auto max-w-3xl px-3 py-16 text-center text-muted-foreground">Hostme is getting ready…</main>;
  }
  return <HomeView initial={data.host} refId={ref} src={src} />;
}
