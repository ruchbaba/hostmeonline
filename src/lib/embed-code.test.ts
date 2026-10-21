import { describe, expect, it } from "vitest";
import { embedSlugOf, embedValue, parseEmbedCode } from "./embed-code";

describe("parseEmbedCode", () => {
  it("reads the slug from the iframe code copied from the share button", () => {
    const code =
      '<iframe src="https://8eb811f9-d356-4979-8e43-67e94377fbee.lovableproject.com/embed/hostme" title="Hostme on Hostme" style="border:0;width:100%;max-width:480px;aspect-ratio:16/9;border-radius:12px" loading="lazy"></iframe>';
    expect(parseEmbedCode(code)).toBe("hostme");
  });

  it("accepts a bare embed URL", () => {
    expect(parseEmbedCode("https://hostme.app/embed/dattatreya-f15c3")).toBe("dattatreya-f15c3");
  });

  it("rejects text that is not an embed", () => {
    expect(parseEmbedCode("https://example.com/banner.webp")).toBeNull();
  });
});

describe("embedSlugOf", () => {
  it("recognises stored embeds but not uploaded image URLs", () => {
    expect(embedSlugOf(embedValue("hostme"))).toBe("hostme");
    expect(embedSlugOf("https://cdn.example.com/embed/x.webp")).toBeNull();
  });
});
