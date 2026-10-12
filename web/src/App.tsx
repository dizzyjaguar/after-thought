import { useCallback, useEffect, useRef, useState } from "react";
import type { Block, PartialBlock } from "@blocknote/core";
import { FormattingToolbarController, useCreateBlockNote } from "@blocknote/react";
import { flip, offset, shift } from "@floating-ui/react";
import { BlockNoteView } from "@blocknote/mantine";
import { bridge, type Folder, type Note, type NoteMeta } from "./bridge";
import { Switcher } from "./Switcher";
import { Sidebar, useSidebarOpen } from "./Sidebar";
import { isEmpty, titleOf } from "./notes";
import { backfillMarkdown, copyNotes, type CopyFormat, type CopyTarget } from "./copy";
import { closeSide, closedBy, openBeside, openHere, updateNote, type Panes } from "./panes";

const newId = () => crypto.randomUUID();

/** Height of the top bar (`.bar`), which also hides the window's drag area in the app. */
const HEADER_HEIGHT = 40;

// The formatting toolbar normally sits above the selection. On a note's first lines that
// lands under the top bar, where it's hidden and can't be clicked. Treat the bar as
// "no room" so the toolbar flips below the selection instead.
const toolbarFloating = {
  useFloatingOptions: {
    middleware: [offset(10), shift(), flip({ padding: { top: HEADER_HEIGHT + 4 } })],
  },
};

const SPLIT_KEY = "at:split";

/** The split from last time, if there was one. Storage can be unavailable, so never throw. */
function loadSplit(): { ids: string[]; active: number } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SPLIT_KEY) ?? "null");
    return Array.isArray(saved?.ids) && saved.ids.length === 2 ? saved : null;
  } catch {
    return null;
  }
}

function saveSplit(ids: string[], active: number) {
  try {
    if (ids.length === 2) localStorage.setItem(SPLIT_KEY, JSON.stringify({ ids, active }));
    else localStorage.removeItem(SPLIT_KEY);
  } catch {
    /* ignore */
  }
}

export function App() {
  // One note, or two side by side. `active` is the side being typed in.
  const [layout, setLayout] = useState<Panes<Note>>({ panes: [], active: 0 });
  // Callbacks that wait on the bridge read this, so they never act on an old layout.
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const { panes, active } = layout;
  const note = panes[active] ?? null;
  // "here" opens the pick on the side being typed in, "beside" on the other side.
  const [switcher, setSwitcher] = useState<"here" | "beside" | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sidebarOpen, setSidebarOpen] = useSidebarOpen();
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "done"; text: string } | { kind: "escHint" } | null>(
    null,
  );
  // Open notes' latest blocks; saves lag behind by a debounce.
  const liveRef = useRef(new Map<string, PartialBlock[]>());
  // Open notes that are still blank, so we can drop them when they're closed.
  const blankRef = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    const [n, f] = await Promise.all([bridge.list(), bridge.folders()]);
    setNotes(n);
    setFolders(f);
  }, []);

  /** Shows a new layout, dropping any blank note it closed, and focuses the active side. */
  const apply = useCallback((next: Panes<Note>) => {
    for (const gone of closedBy(layoutRef.current, next)) {
      liveRef.current.delete(gone.id);
      if (blankRef.current.delete(gone.id)) bridge.remove(gone.id);
    }
    layoutRef.current = next;
    setLayout(next);
    setFocusTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (note) bridge.setLastId(note.id);
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Nothing's open yet on first load; don't wipe the split we're about to restore.
    if (!panes.length) return;
    saveSplit(
      panes.map((p) => p.id),
      active,
    );
  }, [panes.map((p) => p.id).join(), active]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNote = useCallback(
    async (id: string, beside = false) => {
      const open = (l: Panes<Note>, n: Note) => (beside ? openBeside(l, n) : openHere(l, n));
      const existing = layoutRef.current.panes.find((p) => p.id === id);
      if (existing) return apply(open(layoutRef.current, existing));
      const loaded = await bridge.load(id);
      if (loaded) apply(open(layoutRef.current, loaded));
    },
    [apply],
  );

  const newNote = useCallback(
    (folderId: string | null = null) => {
      const current = layoutRef.current;
      const here = current.panes[current.active];
      if (here && blankRef.current.has(here.id)) {
        // Reuse the blank note already open, just file it where asked.
        apply(updateNote(current, here.id, (n) => ({ ...n, folderId })));
        return;
      }
      const fresh: Note = { id: newId(), title: "", content: "", updatedAt: Date.now(), folderId };
      blankRef.current.add(fresh.id);
      apply(openHere(current, fresh));
    },
    [apply],
  );

  const openLast = useCallback(async () => {
    if (layoutRef.current.panes.length) return setFocusTick((t) => t + 1);
    const split = loadSplit();
    if (split) {
      const both = await Promise.all(split.ids.map((id) => bridge.load(id)));
      if (both[0] && both[1]) return apply({ panes: [both[0], both[1]], active: split.active ? 1 : 0 });
    }
    const lastId = (await bridge.getLastId()) ?? (await bridge.list())[0]?.id;
    const loaded = lastId ? await bridge.load(lastId) : null;
    if (loaded) apply({ panes: [loaded], active: 0 });
    else newNote();
  }, [apply, newNote]);

  /** Makes a side the one being typed in. */
  const activate = useCallback((side: number) => {
    setLayout((l) => (l.active === side ? l : { ...l, active: side }));
  }, []);

  const closePane = (side: number) => apply(closeSide(layoutRef.current, side));

  /** Takes a deleted note off screen. */
  const dropNote = (id: string) => {
    setNotes((ns) => ns.filter((n) => n.id !== id));
    const current = layoutRef.current;
    const side = current.panes.findIndex((p) => p.id === id);
    if (side < 0) return;
    blankRef.current.delete(id);
    if (current.panes.length > 1) return apply(closeSide(current, side));
    apply({ panes: [], active: 0 });
    newNote();
  };

  // Commands from the native hotkeys.
  useEffect(() => {
    window.afterThought = {
      command: (name) => {
        if (name === "toggleSidebar") return setSidebarOpen((o) => !o);
        setSwitcher(null);
        if (name === "new") newNote();
        else openLast();
      },
    };
  }, [newNote, openLast, setSidebarOpen]);

  useEffect(() => {
    openLast();
    refresh();
    backfillMarkdown();
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = useCallback(
    async (target: CopyTarget, format: CopyFormat) => {
      const live = [...liveRef.current].map(([id, blocks]) => ({ id, blocks }));
      try {
        setToast({ kind: "done", text: await copyNotes(target, format, notes, folders, live) });
      } catch {
        setToast({ kind: "done", text: "Couldn’t copy that. Try again?" });
      }
    },
    [notes, folders],
  );

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.kind === "escHint" ? 1600 : 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  // App-level shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        if (note) copy({ kind: "note", id: note.id }, "claude");
      } else if (e.metaKey && ["n", "t"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        setSwitcher(null);
        newNote();
      } else if (e.metaKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setSwitcher((s) => (s ? null : "here"));
      } else if (e.metaKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setSwitcher((s) => (s ? null : "beside"));
      } else if (e.metaKey && (e.code === "Backslash" || e.key === "\\")) {
        e.preventDefault();
        setSidebarOpen((o) => !o);
      } else if (e.key === "Escape" && !switcher) {
        if (!e.defaultPrevented && !document.querySelector(".bn-suggestion-menu")) {
          setToast(null);
          bridge.hide();
          return;
        }
        // Something else used this esc: the editor stopped typing, or a menu closed.
        // If the next esc will hide the window, say so.
        window.setTimeout(() => {
          const busy =
            document.activeElement?.closest(".bn-editor") ||
            document.querySelector(
              ".bn-suggestion-menu, .bn-formatting-toolbar, .mantine-Menu-dropdown, .mantine-Popover-dropdown",
            );
          if (!busy) setToast({ kind: "escHint" });
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newNote, switcher, setSidebarOpen, note, copy]);

  const deleteNote = async (id: string) => {
    await bridge.remove(id);
    dropNote(id);
  };

  const moveNote = async (id: string, folderId: string | null) => {
    await bridge.move(id, folderId);
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, folderId } : n)));
    setLayout((l) => updateNote(l, id, (n) => ({ ...n, folderId })));
  };

  const newFolder = async () => {
    const folder = { id: newId(), name: "New folder" };
    const next = [...folders, folder];
    setFolders(next);
    await bridge.saveFolders(next);
    setRenamingFolder(folder.id);
  };

  const renameFolder = async (id: string, name: string) => {
    const next = folders.map((f) => (f.id === id ? { ...f, name } : f));
    setFolders(next);
    await bridge.saveFolders(next);
  };

  const deleteFolder = async (id: string) => {
    await bridge.deleteFolder(id);
    setLayout((l) => ({
      ...l,
      panes: l.panes.map((p) => (p.folderId === id ? { ...p, folderId: null } : p)),
    }));
    refresh();
  };

  const split = panes.length > 1;

  return (
    <div className="shell">
      <header className="bar">
        <button
          className={`bar-toggle ${sidebarOpen ? "on" : ""}`}
          title="Toggle sidebar (⌘\\)"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
            <rect x="2" y="3" width="12" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M6.5 3v10" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
        <span className="title">
          {note?.folderId && (
            <span className="crumb">
              {folders.find((f) => f.id === note.folderId)?.name} /{" "}
            </span>
          )}
          {note?.title || "Untitled"}
        </span>
        <span className="hints">
          <kbd>/</kbd> blocks <kbd>⌘P</kbd> notes <kbd>⌘D</kbd> split <kbd>⌘T</kbd> new <kbd>esc</kbd> hide
        </span>
      </header>
      <div className="body">
        {sidebarOpen && (
          <Sidebar
            notes={notes}
            folders={folders}
            currentId={note?.id}
            besideId={split ? panes[1 - active]?.id : undefined}
            renamingId={renamingFolder}
            onOpen={openNote}
            onNewNote={newNote}
            onDeleteNote={deleteNote}
            onMove={moveNote}
            onNewFolder={newFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
            onRenameDone={() => setRenamingFolder(null)}
            onCopy={copy}
          />
        )}
        <div className={`panes ${split ? "split" : ""}`}>
          {panes.map((p, side) => (
            <section
              key={p.id}
              className={`pane ${side === active ? "active" : ""}`}
              onFocus={() => activate(side)}
            >
              {split && (
                <div
                  className="pane-head"
                  onMouseDown={() => {
                    activate(side);
                    setFocusTick((t) => t + 1);
                  }}
                >
                  <span className="pane-title">{p.title || "Untitled"}</span>
                  <button
                    className="sb-icon"
                    title="Close this side"
                    aria-label="Close this side"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => closePane(side)}
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
                      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )}
              <Editor
                note={p}
                active={side === active}
                focusTick={focusTick}
                onChange={(title, empty, blocks) => {
                  if (empty) blankRef.current.add(p.id);
                  else blankRef.current.delete(p.id);
                  liveRef.current.set(p.id, blocks);
                  setLayout((l) => updateNote(l, p.id, (n) => (n.title === title ? n : { ...n, title })));
                  if (empty) return;
                  // Keep the sidebar in step without re-reading every file.
                  setNotes((ns) => {
                    const meta = { id: p.id, title, updatedAt: Date.now(), folderId: p.folderId };
                    const rest = ns.filter((n) => n.id !== p.id);
                    return [meta, ...rest];
                  });
                }}
              />
            </section>
          ))}
        </div>
      </div>
      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          {toast.kind === "escHint" ? (
            <span>
              Press <kbd>esc</kbd> again to hide
            </span>
          ) : (
            <>
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
                <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {toast.text}
            </>
          )}
        </div>
      )}
      {switcher && (
        <Switcher
          openIds={panes.map((p) => p.id)}
          placeholder={switcher === "beside" ? "Open to the side…" : "Search notes…"}
          onPick={(id) => {
            setSwitcher(null);
            openNote(id, switcher === "beside");
          }}
          folders={folders}
          onDeleted={(id) => {
            if (panes.some((p) => p.id === id)) setSwitcher(null);
            dropNote(id);
          }}
          onClose={() => {
            setSwitcher(null);
            setFocusTick((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}

function Editor({
  note,
  active,
  focusTick,
  onChange,
}: {
  note: Note;
  /** The side being typed in. Only it takes focus and handles undo. */
  active: boolean;
  focusTick: number;
  onChange: (title: string, empty: boolean, blocks: Block[]) => void;
}) {
  const editor = useCreateBlockNote({
    initialContent: note.content
      ? (JSON.parse(note.content) as PartialBlock[])
      : undefined,
  });
  const timer = useRef<number | undefined>(undefined);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (activeRef.current) editor.focus();
  }, [editor, focusTick]);

  // Menus (e.g. the block menu's Colors) take focus and don't hand it back, so
  // ⌘Z would land on <body> and do nothing. Route undo/redo to the editor then.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!activeRef.current) return;
      if (!e.metaKey || e.key.toLowerCase() !== "z" || e.defaultPrevented) return;
      const active = document.activeElement;
      if (active?.closest(".bn-editor, input, textarea")) return;
      e.preventDefault();
      if (e.shiftKey) editor.redo();
      else editor.undo();
      editor.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor]);

  // Flush a pending save if the editor goes away mid-debounce.
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => () => pending.current?.(), []);

  return (
    <div className="editor-wrap">
      <BlockNoteView
        editor={editor}
        formattingToolbar={false}
        onChange={() => {
          const blocks = editor.document;
          const title = titleOf(blocks);
          const empty = isEmpty(blocks);
          onChange(title, empty, blocks);
          window.clearTimeout(timer.current);
          const save = () => {
            pending.current = null;
            if (!empty) {
              const markdown = editor.blocksToMarkdownLossy(blocks).trim();
              bridge.save(note.id, title, JSON.stringify(blocks), note.folderId, markdown);
            }
          };
          pending.current = save;
          timer.current = window.setTimeout(save, 300);
        }}
      >
        <FormattingToolbarController floatingUIOptions={toolbarFloating} />
      </BlockNoteView>
    </div>
  );
}
