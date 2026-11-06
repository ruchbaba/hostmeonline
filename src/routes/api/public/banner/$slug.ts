import { createFileRoute } from "@tanstack/react-router";

// Stable, always-current banner image for a host (email signatures, external sites).
export const Route = createFileRoute("/api/public/banner/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = String(params.slug || "").replace(/\.(webp|png|jpg)$/, "");
        if (!/^[a-z0-9-]{1,120}$/.test(slug)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: host } = await supabaseAdmin.from("hosts").select("id, image_url").eq("slug", slug).maybeSingle();
        // Alternate host and guests: each new load (email/chat preview refresh) shows the next banner every 5s.
        const { data: guests } = host ? await supabaseAdmin.rpc("host_guests", { p_host: host.id }) : { data: null };
        const images = [host?.image_url, ...((guests ?? []) as { image_url: string }[]).slice(0, 6).map((g) => g.image_url)].filter(Boolean) as string[];
        const pick = images.length ? images[Math.floor(Date.now() / 5000) % images.length] : undefined;
        const path = pick?.replace(/^\/api\/public\/img\//, "");
        if (!path) return new Response("Not found", { status: 404 });
        const { data, error } = await supabaseAdmin.storage.from("banners").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: { "content-type": data.type || "image/webp", "cache-control": "no-cache, max-age=0" },
        });
      },
    },
  },
});
