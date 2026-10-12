// The editor shows one note, or two side by side. These rules decide which note
// goes where. A note is never open on both sides: two editors saving the same
// file would overwrite each other.

export type Panes<T extends { id: string }> = { panes: T[]; active: number };

/** Opens `note` on the side being typed in, replacing what's there. */
export function openHere<T extends { id: string }>({ panes, active }: Panes<T>, note: T): Panes<T> {
  const at = panes.findIndex((p) => p.id === note.id);
  if (at >= 0) return { panes, active: at };
  if (!panes.length) return { panes: [note], active: 0 };
  const next = [...panes];
  next[active] = note;
  return { panes: next, active };
}

/** Opens `note` on the other side, splitting the editor if it isn't already. */
export function openBeside<T extends { id: string }>({ panes, active }: Panes<T>, note: T): Panes<T> {
  const at = panes.findIndex((p) => p.id === note.id);
  if (at >= 0) return { panes, active: at };
  if (panes.length < 2) return { panes: [...panes, note], active: panes.length };
  const other = 1 - active;
  const next = [...panes];
  next[other] = note;
  return { panes: next, active: other };
}

/** Closes one side of a split. The last note can't be closed this way. */
export function closeSide<T extends { id: string }>({ panes, active }: Panes<T>, side: number): Panes<T> {
  if (panes.length < 2) return { panes, active };
  return { panes: panes.filter((_, i) => i !== side), active: 0 };
}

/** Swaps one note for a changed copy of it, wherever it's open. */
export function updateNote<T extends { id: string }>(
  { panes, active }: Panes<T>,
  id: string,
  change: (note: T) => T,
): Panes<T> {
  if (!panes.some((p) => p.id === id)) return { panes, active };
  return { panes: panes.map((p) => (p.id === id ? change(p) : p)), active };
}

/** The notes that were open in `before` and aren't in `after`. */
export function closedBy<T extends { id: string }>(before: Panes<T>, after: Panes<T>): T[] {
  return before.panes.filter((p) => !after.panes.some((n) => n.id === p.id));
}

/** Narrowest a side of the split can be dragged, in px. */
export const MIN_PANE_WIDTH = 300;

/** Keeps a dragged split ratio (left side's share, 0 to 1) wide enough on both sides. */
export function clampRatio(ratio: number, width: number): number {
  const min = width > 0 ? Math.min(0.5, MIN_PANE_WIDTH / width) : 0.5;
  return Math.min(1 - min, Math.max(min, ratio));
}
