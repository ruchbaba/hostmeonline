import { describe, expect, it } from "vitest";
import { PUBLISHED_ORIGIN, publicOrigin } from "./public-origin";

describe("publicOrigin", () => {
  it("swaps editor and preview addresses for the published one", () => {
    expect(publicOrigin("https://8eb811f9-d356-4979-8e43-67e94377fbee.lovableproject.com")).toBe(PUBLISHED_ORIGIN);
    expect(publicOrigin("https://id-preview--8eb811f9-d356-4979-8e43-67e94377fbee.lovable.app")).toBe(PUBLISHED_ORIGIN);
  });

  it("sends Lovable and Vercel addresses to hostmeonline.com, keeps other domains", () => {
    expect(publicOrigin("https://hostmeonline.lovable.app")).toBe("https://hostmeonline.com");
    expect(publicOrigin("https://hostmeonline.com")).toBe("https://hostmeonline.com");
    expect(publicOrigin("https://hostme.app")).toBe("https://hostme.app");
  });
});
