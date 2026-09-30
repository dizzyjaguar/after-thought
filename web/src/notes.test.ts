import { describe, expect, it } from "vitest";
import type { Block } from "@blocknote/core";
import { isEmpty, titleOf } from "./notes";

// Just enough of a BlockNote block for these helpers.
const block = (type: string, content: unknown, children: unknown[] = []) =>
  ({ id: "x", type, props: {}, content, children }) as unknown as Block;
const text = (t: string) => ({ type: "text", text: t, styles: {} });

describe("titleOf", () => {
  it("uses the first line that has text", () => {
    expect(titleOf([block("paragraph", []), block("heading", [text("Paint colors")])])).toBe("Paint colors");
  });

  it("joins styled pieces and text inside links", () => {
    const blocks = [block("paragraph", [text("Buy "), { type: "link", content: [text("paint")] }])];
    expect(titleOf(blocks)).toBe("Buy paint");
  });

  it("trims and cuts long titles to 80 characters", () => {
    expect(titleOf([block("paragraph", [text("  hi  ")])])).toBe("hi");
    expect(titleOf([block("paragraph", [text("x".repeat(200))])])).toHaveLength(80);
  });

  it("is empty for a blank note", () => {
    expect(titleOf([block("paragraph", [])])).toBe("");
  });
});

describe("isEmpty", () => {
  it("is true for blank paragraphs only", () => {
    expect(isEmpty([block("paragraph", [])])).toBe(true);
    expect(isEmpty([block("paragraph", [text("   ")])])).toBe(true);
  });

  it("is false once there's text, another block type, or nested blocks", () => {
    expect(isEmpty([block("paragraph", [text("a")])])).toBe(false);
    expect(isEmpty([block("checkListItem", [])])).toBe(false);
    expect(isEmpty([block("paragraph", [], [block("paragraph", [])])])).toBe(false);
  });
});
