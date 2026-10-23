import { describe, expect, it } from "vitest";
import { expandTerms } from "./tags";

describe("search by related meaning", () => {
  it("keeps the typed word first", () => {
    expect(expandTerms("#Yoga")[0]).toBe("yoga");
  });

  it("finds the whole category when no tag matches exactly", () => {
    const t = expandTerms("yoga");
    expect(t).toContain("fitness");
    expect(t).toContain("gym");
  });

  it("understands word forms", () => {
    expect(expandTerms("designers")).toContain("branding");
  });

  it("forgives small typos", () => {
    expect(expandTerms("photograpy")).toContain("camera");
  });

  it("matches a family word inside a compound tag", () => {
    expect(expandTerms("streetphotography")).toContain("portrait");
  });

  it("links instruments to music", () => {
    expect(expandTerms("guitar")).toContain("music");
  });

  it("does not invent relations for unrelated words", () => {
    expect(expandTerms("zzqx")).toEqual(["zzqx"]);
  });
});
