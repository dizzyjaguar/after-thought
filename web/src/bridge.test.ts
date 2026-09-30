// The in-browser stand-in for the Mac app's storage (used by `npm run dev`).
import { beforeEach, describe, expect, it } from "vitest";
import { bridge } from "./bridge";

beforeEach(() => localStorage.clear());

describe("browser storage fallback", () => {
  it("saves and loads a note", async () => {
    await bridge.save("a", "Paint", "[1]", null, "# Paint");
    const note = await bridge.load("a");
    expect(note).toMatchObject({ id: "a", title: "Paint", content: "[1]", folderId: null });
    expect(await bridge.load("missing")).toBeNull();
  });

  it("lists newest first", async () => {
    await bridge.save("old", "Old", "[]", null, "");
    await new Promise((r) => setTimeout(r, 5));
    await bridge.save("new", "New", "[]", null, "");
    expect((await bridge.list()).map((n) => n.id)).toEqual(["new", "old"]);
  });

  it("only uses the folder when a note is created; moving changes it", async () => {
    await bridge.save("a", "A", "[]", "f1", "");
    await bridge.save("a", "A", "[]", "f2", "");
    expect((await bridge.load("a"))?.folderId).toBe("f1");

    await bridge.move("a", "f2");
    expect((await bridge.load("a"))?.folderId).toBe("f2");
  });

  it("deleting a folder keeps its notes", async () => {
    await bridge.saveFolders([
      { id: "f1", name: "Home" },
      { id: "f2", name: "Work" },
    ]);
    await bridge.save("a", "A", "[]", "f1", "");

    await bridge.deleteFolder("f1");

    expect(await bridge.folders()).toEqual([{ id: "f2", name: "Work" }]);
    expect((await bridge.load("a"))?.folderId).toBeNull();
  });

  it("deletes a note", async () => {
    await bridge.save("a", "A", "[]", null, "");
    await bridge.remove("a");
    expect(await bridge.load("a")).toBeNull();
  });

  it("remembers the last note", async () => {
    await bridge.setLastId("a");
    expect(await bridge.getLastId()).toBe("a");
  });
});
