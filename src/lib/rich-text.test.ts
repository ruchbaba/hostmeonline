import { describe, expect, it } from "vitest";
import { parseRich, wrapSelection } from "./rich-text";

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
