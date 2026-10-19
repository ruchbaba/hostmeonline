import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  dataUrl: z
    .string()
    .max(3_000_000)
    .regex(/^data:image\/(webp|png|jpeg);base64,/),
});

/**
 * Image safety check through Lovable AI. Blocks explicit, violent or hateful banners.
 * Fails open (allowed: true, flagged: true) when the check itself is unavailable,
 * so a temporary outage never blocks legitimate uploads.
 */
export const moderateImage = createServerFn({ method: "POST" })
  .inputValidator((d: { dataUrl: string }) => schema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { allowed: true, flagged: true, reason: "check unavailable" };
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-lite",
          messages: [
            {
              role: "system",
              content:
                "You moderate banner images for a public, all-ages community site. Reply with JSON only: {\"safe\": boolean, \"reason\": string}. Unsafe means: nudity or sexual content, graphic violence or gore, hate symbols, harassment, illegal drugs, or self-harm. Ordinary ads, text, products, people and art are safe.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Is this banner safe to publish? Answer in json." },
                { type: "image_url", image_url: { url: data.dataUrl } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        console.error("moderation gateway error", res.status, await res.text().catch(() => ""));
        return { allowed: true, flagged: true, reason: "check unavailable" };
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = match ? (JSON.parse(match[0]) as { safe?: boolean; reason?: string }) : null;
      if (parsed && parsed.safe === false) {
        return { allowed: false, flagged: true, reason: parsed.reason || "This image can't be published." };
      }
      return { allowed: true, flagged: false, reason: "" };
    } catch (e) {
      console.error("moderation failed", e);
      return { allowed: true, flagged: true, reason: "check unavailable" };
    }
  });
