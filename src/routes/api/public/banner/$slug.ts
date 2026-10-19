import { createFileRoute } from "@tanstack/react-router";

// Stable, always-current banner image for a host (email signatures, external sites).
export const Route = createFileRoute("/api/public/banner/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = String(params.slug || "").replace(/\.(webp|png|jpg)$/, "");
        if (!/^[a-z0-9-]{1,120}$/.test(slug)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: host } = await supabaseAdmin.from("hosts").select("image_url").eq("slug", slug).maybeSingle();
        const path = host?.image_url?.replace(/^\/api\/public\/img\//, "");
        if (!path) return new Response("Not found", { status: 404 });
        const { data, error } = await supabaseAdmin.storage.from("banners").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: { "content-type": data.type || "image/webp", "cache-control": "public, max-age=300" },
        });
      },
    },
  },
});
