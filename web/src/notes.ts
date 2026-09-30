import type { Block } from "@blocknote/core";

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((c) => (c.type === "text" ? c.text : inlineText(c.content)))
    .join("");
}

/** A note's title: the first line of text, up to 80 characters. */
export function titleOf(blocks: Block[]): string {
  for (const b of blocks) {
    const text = inlineText(b.content).trim();
    if (text) return text.slice(0, 80);
  }
  return "";
}

/** True for a note with nothing in it yet (only blank paragraphs). */
export function isEmpty(blocks: Block[]): boolean {
  return blocks.every(
    (b) => b.type === "paragraph" && !inlineText(b.content).trim() && !b.children.length,
  );
}
