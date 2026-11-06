import { createFileRoute } from "@tanstack/react-router";

// Stable, always-current banner image for a host (email signatures, chats, external sites).
// Each load shows the next slide (host → guests, with a tag-matched "Sponsor with Hosts" renter on every 3rd slot)
// and counts the host's shared impression plus the renter's impression.
export const Route = createFileRoute("/api/public/banner/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slug = String(params.slug || "").replace(/\.(webp|png|jpg)$/, "");
        if (!/^[a-z0-9-]{1,120}$/.test(slug)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: host } = await supabaseAdmin.from("hosts").select("id, image_url, tags").eq("slug", slug).maybeSingle();
        if (!host) return new Response("Not found", { status: 404 });
        const { data: guests } = await supabaseAdmin.rpc("host_guests", { p_host: host.id });
        const gl = ((guests ?? []) as { id: string; image_url: string }[]).filter((g) => g.image_url).slice(0, 6);
        const { data: sp } = await supabaseAdmin.rpc("pick_sponsors", {
          p_kind: "hosts",
          p_tags: host.tags ?? [],
          p_exclude: [host.id, ...gl.map((g) => g.id)],
          p_limit: 2,
        });
        const sponsors = ((sp ?? []) as { campaign_id: string; image_url: string }[]).filter((s) => s.image_url);
        type Slide = { image: string; campaign?: string };
        const slides: Slide[] = [];
        if (host.image_url) slides.push({ image: host.image_url });
        let si = 0;
        for (const g of gl) {
          if (sponsors.length && (slides.length + 1) % 3 === 0) slides.push({ image: sponsors[si++ % sponsors.length]!.image_url, campaign: sponsors[(si - 1) % sponsors.length]!.campaign_id });
          slides.push({ image: g.image_url });
        }
        if (sponsors.length && !slides.some((s) => s.campaign)) {
          slides.push({ image: sponsors[0]!.image_url, campaign: sponsors[0]!.campaign_id });
        }
        if (!slides.length) return new Response("Not found", { status: 404 });
        const pick = slides[Math.floor(Date.now() / 5000) % slides.length]!;

        // Session per viewer connection + day, so repeated reloads are not counted endlessly.
        const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
        const day = new Date().toISOString().slice(0, 10);
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${day}|${slug}`));
        const session = "img-" + Array.from(new Uint8Array(buf).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
        await Promise.allSettled([
          supabaseAdmin.rpc("track_shared_impression", { p_host: host.id, p_session: session }),
          pick.campaign ? supabaseAdmin.rpc("track_impression", { p_campaign: pick.campaign, p_host: host.id, p_context: "shared", p_session: session }) : Promise.resolve(),
        ]);

        const path = pick.image.startsWith("/api/public/img/")
          ? pick.image.replace(/^\/api\/public\/img\//, "")
          : pick.image.split("/storage/v1/object/public/banners/")[1];
        if (!path) return Response.redirect(pick.image, 302);
        const { data, error } = await supabaseAdmin.storage.from("banners").download(decodeURIComponent(path));
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: { "content-type": data.type || "image/webp", "cache-control": "no-store, max-age=0" },
        });
      },
    },
  },
});
