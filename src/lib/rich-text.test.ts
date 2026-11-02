import { describe, expect, it } from "vitest";
import { bulletLines, parseRich, plainText, wrapSelection } from "./rich-text";

describe("parseRich", () => {
  it("makes **text** bold", () => {
    expect(parseRich("Hi **there** you")).toEqual([
      { type: "text", text: "Hi " },
      { type: "bold", children: [{ type: "text", text: "there" }] },
      { type: "text", text: " you" },
    ]);
  });

  it("supports the three sizes and bold inside a size", () => {
    expect(parseRich("[xl]Big **one**[/xl]")).toEqual([
      { type: "size", size: "xl", children: [{ type: "text", text: "Big " }, { type: "bold", children: [{ type: "text", text: "one" }] }] },
    ]);
    expect(parseRich("[sm]a[/sm][lg]b[/lg]")).toEqual([
      { type: "size", size: "sm", children: [{ type: "text", text: "a" }] },
      { type: "size", size: "lg", children: [{ type: "text", text: "b" }] },
    ]);
  });

  it("supports italic, underline, alignment and palette colors", () => {
    expect(parseRich("[i]a[/i][u]b[/u]")).toEqual([
      { type: "style", style: "i", children: [{ type: "text", text: "a" }] },
      { type: "style", style: "u", children: [{ type: "text", text: "b" }] },
    ]);
    expect(parseRich("[center]mid[/center]")).toEqual([{ type: "align", align: "center", children: [{ type: "text", text: "mid" }] }]);
    expect(parseRich("[color=gold]g[/color]")).toEqual([{ type: "color", color: "gold", children: [{ type: "text", text: "g" }] }]);
  });

  it("only accepts web links and known colors", () => {
    expect(parseRich("[url=https://hostme.app]go[/url]")).toEqual([
      { type: "link", href: "https://hostme.app", children: [{ type: "text", text: "go" }] },
    ]);
    expect(parseRich("[url=javascript:alert(1)]x[/url]")).toEqual([{ type: "text", text: "[url=javascript:alert(1)]x[/url]" }]);
    expect(parseRich("[color=orange]x[/color]")).toEqual([{ type: "text", text: "[color=orange]x[/color]" }]);
  });

  it("keeps unclosed markers as plain text", () => {
    expect(parseRich("5 ** 2 and [lg]open")).toEqual([{ type: "text", text: "5 ** 2 and [lg]open" }]);
  });
});

describe("wrapSelection", () => {
  it("wraps the selected words and keeps them selected", () => {
    expect(wrapSelection("say hello now", 4, 9, "**", "**")).toEqual({ value: "say **hello** now", start: 6, end: 11 });
  });

  it("inserts a placeholder when nothing is selected", () => {
    expect(wrapSelection("ab", 1, 1, "[lg]", "[/lg]")).toEqual({ value: "a[lg]text[/lg]b", start: 5, end: 9 });
  });
});

describe("bulletLines", () => {
  it("bullets every selected line once", () => {
    expect(bulletLines("one\ntwo\n• three", 0, 15).value).toBe("• one\n• two\n• three");
  });
});

describe("plainText", () => {
  it("strips the markers", () => {
    expect(plainText("[center]**Hi** [color=red]there[/color][/center]")).toBe("Hi there");
  });
});
