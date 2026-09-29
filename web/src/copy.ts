// Turns notes into Markdown and puts it on the clipboard: as a .md file for Claude,
// or as plain text.
import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { bridge, type Folder, type NoteMeta } from "./bridge";

export type CopyFormat = "claude" | "markdown";
export type CopyTarget = { kind: "note" | "folder"; id: string };

type Collected = { title: string; markdown: string };

// One off-screen editor, only used for its Markdown exporter.
let exporter: BlockNoteEditor | null = null;

export function toMarkdown(blocks: PartialBlock[]): string {
  if (!blocks.length) return "";
  exporter ??= BlockNoteEditor.create();
  return exporter.blocksToMarkdownLossy(blocks).trim();
}

/**
 * Builds the text and copies it. `live` is the open note's current blocks, which
 * can be newer than what's saved (saves are debounced).
 * Returns a short message for the toast.
 */
export async function copyNotes(
  target: CopyTarget,
  format: CopyFormat,
  notes: NoteMeta[],
  folders: Folder[],
  live: { id: string; blocks: PartialBlock[] } | null,
): Promise<string> {
  const folderName = (id: string | null) => folders.find((f) => f.id === id)?.name ?? null;

  const ids =
    target.kind === "note"
      ? [target.id]
      : notes.filter((n) => n.folderId === target.id).map((n) => n.id);

  const collected: Collected[] = [];
  for (const id of ids) {
    let blocks: PartialBlock[] | null = null;
    let meta = notes.find((n) => n.id === id);
    if (live?.id === id) {
      blocks = live.blocks;
    } else {
      const loaded = await bridge.load(id);
      if (loaded) {
        meta = loaded;
        blocks = loaded.content ? (JSON.parse(loaded.content) as PartialBlock[]) : [];
      }
    }
    const markdown = blocks ? toMarkdown(blocks) : "";
    if (!markdown) continue;
    collected.push({ title: meta?.title || "Untitled", markdown });
  }

  const name =
    target.kind === "folder" ? folderName(target.id) ?? "Folder" : collected[0]?.title ?? "Note";
  if (!collected.length) {
    return target.kind === "folder" ? `“${name}” has no notes to copy` : "This note is empty";
  }

  const text =
    target.kind === "folder"
      ? `# ${name}\n\n${collected.map((n) => n.markdown).join("\n\n---\n\n")}\n`
      : `${collected[0].markdown}\n`;

  if (format === "claude") {
    // A file, not text: pastes into Claude as one attachment instead of a wall of lines.
    const fileName = `${name}.md`;
    await bridge.copyFile(fileName, text);
    return `Copied “${fileName}”. Paste into Claude.`;
  }

  await bridge.copy(text);
  const what =
    target.kind === "folder"
      ? `“${name}”: ${collected.length} note${collected.length === 1 ? "" : "s"}`
      : `“${name}”`;
  return `Copied ${what} as Markdown.`;
}

/** Fills in Markdown for notes saved before the Markdown mirror existed. Runs once per note. */
export async function backfillMarkdown() {
  for (const id of await bridge.idsMissingMarkdown()) {
    const note = await bridge.load(id);
    if (!note?.content) continue;
    await bridge.setMarkdown(id, toMarkdown(JSON.parse(note.content) as PartialBlock[]));
  }
}
