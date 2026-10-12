import { describe, expect, it } from "vitest";
import { closeSide, closedBy, openBeside, openHere, updateNote } from "./panes";

const n = (id: string) => ({ id });
const one = { panes: [n("paint")], active: 0 };
const two = { panes: [n("paint"), n("bath")], active: 0 };

describe("openHere", () => {
  it("opens the first note into an empty editor", () => {
    expect(openHere({ panes: [], active: 0 }, n("paint"))).toEqual(one);
  });

  it("replaces the note on the side being typed in", () => {
    expect(openHere({ ...two, active: 1 }, n("garden"))).toEqual({
      panes: [n("paint"), n("garden")],
      active: 1,
    });
  });

  it("jumps to a note that's already open instead of opening it twice", () => {
    expect(openHere(two, n("bath"))).toEqual({ ...two, active: 1 });
  });
});

describe("openBeside", () => {
  it("splits the editor and types in the new side", () => {
    expect(openBeside(one, n("bath"))).toEqual({ ...two, active: 1 });
  });

  it("replaces the side not being typed in", () => {
    expect(openBeside(two, n("garden"))).toEqual({ panes: [n("paint"), n("garden")], active: 1 });
    expect(openBeside({ ...two, active: 1 }, n("garden"))).toEqual({
      panes: [n("garden"), n("bath")],
      active: 0,
    });
  });

  it("jumps to a note that's already open", () => {
    expect(openBeside(one, n("paint"))).toEqual(one);
    expect(openBeside({ ...two, active: 1 }, n("paint"))).toEqual(two);
  });
});

describe("closeSide", () => {
  it("closes either side and keeps the other", () => {
    expect(closeSide(two, 0)).toEqual({ panes: [n("bath")], active: 0 });
    expect(closeSide({ ...two, active: 1 }, 1)).toEqual(one);
  });

  it("won't close the only note", () => {
    expect(closeSide(one, 0)).toEqual(one);
  });
});

describe("updateNote", () => {
  it("changes the note wherever it's open", () => {
    const panes = [{ id: "paint", title: "a" }, { id: "bath", title: "b" }];
    const next = updateNote({ panes, active: 0 }, "bath", (p) => ({ ...p, title: "c" }));
    expect(next.panes[1].title).toBe("c");
    expect(next.panes[0]).toBe(panes[0]);
  });

  it("leaves things alone when the note isn't open", () => {
    const before = { panes: [{ id: "paint", title: "a" }], active: 0 };
    expect(updateNote(before, "bath", (p) => ({ ...p, title: "c" })).panes).toBe(before.panes);
  });
});

describe("closedBy", () => {
  it("lists the notes a change took off screen", () => {
    expect(closedBy(two, openHere(two, n("garden")))).toEqual([n("paint")]);
    expect(closedBy(two, closeSide(two, 1))).toEqual([n("bath")]);
    expect(closedBy(one, openBeside(one, n("bath")))).toEqual([]);
  });
});
