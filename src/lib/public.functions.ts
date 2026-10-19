import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createPublicClient } from "./public-client.server";
import type { Tables } from "@/integrations/supabase/types";

export type HostRow = Tables<"hosts">;
export type StaticPageRow = Tables<"static_pages">;

function originOf(): string {
  try {
    const req = getRequest();
    const u = new URL(req.url);
    const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
    return `${proto}://${host}`;
  } catch {
    return "";
  }
}

function abs(origin: string, url: string) {
  if (!url) return "";
  return /^https?:\/\//.test(url) ? url : origin + url;
}

export const getHomeHost = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createPublicClient();
  const { data } = await sb.from("hosts").select("*").eq("is_home", true).maybeSingle();
  const origin = originOf();
  return { host: data as HostRow | null, ogImage: data ? abs(origin, data.image_url) : "" };
});

export const resolveSlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const sb = createPublicClient();
    const origin = originOf();
    const { data: page } = await sb
      .from("static_pages")
      .select("*")
      .or(`slug.eq.${data.slug.replace(/[^a-z0-9-]/gi, "")},key.eq.${data.slug.replace(/[^a-z0-9-]/gi, "")}`)
      .maybeSingle();
    if (page) {
      return { kind: "page" as const, page: page as StaticPageRow, host: null, ogImage: abs(origin, page.banner1_url) };
    }
    const { data: host } = await sb.from("hosts").select("*").eq("slug", data.slug).maybeSingle();
    if (host) {
      return { kind: "host" as const, host: host as HostRow, page: null, ogImage: abs(origin, host.image_url) };
    }
    return { kind: "none" as const, host: null, page: null, ogImage: "" };
  });

export const getStaticPage = createServerFn({ method: "GET" })
  .inputValidator((d: { key: string }) => z.object({ key: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const sb = createPublicClient();
    const { data: page } = await sb.from("static_pages").select("*").eq("key", data.key).maybeSingle();
    return { page: page as StaticPageRow | null, ogImage: page ? abs(originOf(), page.banner1_url) : "" };
  });

export const getEmbedHost = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const sb = createPublicClient();
    const { data: host } = await sb.from("hosts").select("*").eq("slug", data.slug).maybeSingle();
    return { host: host as HostRow | null, origin: originOf() };
  });
