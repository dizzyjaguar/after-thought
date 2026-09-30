import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PartialBlock } from "@blocknote/core";
import { bridge, type Folder, type NoteMeta } from "./bridge";
import { copyNotes, toMarkdown } from "./copy";

const paint: PartialBlock[] = [
  { type: "heading", props: { level: 1 }, content: "Paint colors" },
  {
    type: "paragraph",
    content: [
      { type: "text", text: "Leaning ", styles: {} },
      { type: "text", text: "warm", styles: { bold: true } },
    ],
  },
  { type: "checkListItem", props: { checked: true }, content: "Get samples" },
  { type: "checkListItem", props: { checked: false }, content: "Test in morning light" },
];

const folders: Folder[] = [{ id: "home", name: "Home projects" }];
let notes: NoteMeta[];

beforeEach(async () => {
  localStorage.clear();
  vi.restoreAllMocks();
  await bridge.save("paint", "Paint colors", JSON.stringify(paint), "home", "");
  await bridge.save("bath", "Bathroom", JSON.stringify([{ type: "paragraph", content: "Tiles" }]), "home", "");
  await bridge.save("empty", "", "[]", null, "");
  notes = await bridge.list();
});

describe("toMarkdown", () => {
  it("keeps headings, bold, and checklists", () => {
    const md = toMarkdown(paint);
    expect(md).toContain("# Paint colors");
    expect(md).toContain("**warm**");
    expect(md).toContain("[x] Get samples");
    expect(md).toContain("[ ] Test in morning light");
  });

  it("is empty for no blocks", () => {
    expect(toMarkdown([])).toBe("");
  });
});

describe("Copy for Claude", () => {
  it("copies a note as one .md file named after it", async () => {
    const copyFile = vi.spyOn(bridge, "copyFile").mockResolvedValue(true);
    const message = await copyNotes({ kind: "note", id: "paint" }, "claude", notes, folders, null);

    expect(copyFile).toHaveBeenCalledTimes(1);
    const [name, text] = copyFile.mock.calls[0];
    expect(name).toBe("Paint colors.md");
    expect(text).toContain("# Paint colors");
    expect(message).toBe("Copied “Paint colors.md”. Paste into Claude.");
  });

  it("copies a whole folder as one file named after the folder", async () => {
    const copyFile = vi.spyOn(bridge, "copyFile").mockResolvedValue(true);
    await copyNotes({ kind: "folder", id: "home" }, "claude", notes, folders, null);

    const [name, text] = copyFile.mock.calls[0];
    expect(name).toBe("Home projects.md");
    expect(text).toMatch(/^# Home projects\n/);
    expect(text).toContain("Paint colors");
    expect(text).toContain("Tiles");
  });

  it("uses what's on screen, even if it isn't saved yet", async () => {
    const copyFile = vi.spyOn(bridge, "copyFile").mockResolvedValue(true);
    const live = { id: "paint", blocks: [{ type: "paragraph", content: "Just typed" }] as PartialBlock[] };
    await copyNotes({ kind: "note", id: "paint" }, "claude", notes, folders, live);
    expect(copyFile.mock.calls[0][1]).toBe("Just typed\n");
  });
});

describe("Copy as Markdown", () => {
  it("copies plain text, not a file", async () => {
    const copy = vi.spyOn(bridge, "copy").mockResolvedValue(true);
    const copyFile = vi.spyOn(bridge, "copyFile");
    const message = await copyNotes({ kind: "folder", id: "home" }, "markdown", notes, folders, null);

    expect(copyFile).not.toHaveBeenCalled();
    expect(copy.mock.calls[0][0]).toContain("\n\n---\n\n");
    expect(message).toBe("Copied “Home projects”: 2 notes as Markdown.");
  });
});

describe("nothing to copy", () => {
  it("says so instead of copying", async () => {
    const copy = vi.spyOn(bridge, "copy");
    const copyFile = vi.spyOn(bridge, "copyFile");
    const withEmpty = [...folders, { id: "none", name: "Empty folder" }];

    expect(await copyNotes({ kind: "note", id: "empty" }, "claude", notes, folders, null)).toBe(
      "This note is empty",
    );
    expect(
      await copyNotes({ kind: "folder", id: "none" }, "claude", notes, withEmpty, null),
    ).toBe("“Empty folder” has no notes to copy");
    expect(copy).not.toHaveBeenCalled();
    expect(copyFile).not.toHaveBeenCalled();
  });
});
