import { useCallback, useEffect, useRef, useState } from "react";
import type { Block, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { bridge, type Folder, type Note, type NoteMeta } from "./bridge";
import { Switcher } from "./Switcher";
import { Sidebar, useSidebarOpen } from "./Sidebar";
import { backfillMarkdown, copyNotes, type CopyFormat, type CopyTarget } from "./copy";

const newId = () => crypto.randomUUID();

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((c) => (c.type === "text" ? c.text : inlineText(c.content)))
    .join("");
}

function titleOf(blocks: Block[]): string {
  for (const b of blocks) {
    const text = inlineText(b.content).trim();
    if (text) return text.slice(0, 80);
  }
  return "";
}

function isEmpty(blocks: Block[]): boolean {
  return blocks.every(
    (b) => b.type === "paragraph" && !inlineText(b.content).trim() && !b.children.length,
  );
}

export function App() {
  const [note, setNote] = useState<Note | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sidebarOpen, setSidebarOpen] = useSidebarOpen();
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // The open note's latest blocks; saves lag behind by a debounce.
  const liveRef = useRef<{ id: string; blocks: PartialBlock[] } | null>(null);
  // Tracks whether the open note is still blank, so we can drop it when leaving.
  const blankRef = useRef(true);

  const refresh = useCallback(async () => {
    const [n, f] = await Promise.all([bridge.list(), bridge.folders()]);
    setNotes(n);
    setFolders(f);
  }, []);

  const leaveCurrent = useCallback(async () => {
    if (note && blankRef.current) await bridge.remove(note.id);
  }, [note]);

  const openNote = useCallback(
    async (id: string) => {
      if (note?.id === id) return setFocusTick((t) => t + 1);
      const loaded = await bridge.load(id);
      if (!loaded) return;
      await leaveCurrent();
      blankRef.current = false;
      setNote(loaded);
      bridge.setLastId(id);
    },
    [note, leaveCurrent],
  );

  const newNote = useCallback(async (folderId: string | null = null) => {
    if (note && blankRef.current) {
      // Reuse the blank note already open, just file it where asked.
      setNote({ ...note, folderId });
      return setFocusTick((t) => t + 1);
    }
    await leaveCurrent();
    const fresh: Note = { id: newId(), title: "", content: "", updatedAt: Date.now(), folderId };
    blankRef.current = true;
    setNote(fresh);
    bridge.setLastId(fresh.id);
  }, [note, leaveCurrent]);

  const openLast = useCallback(async () => {
    if (note) return setFocusTick((t) => t + 1);
    const lastId = (await bridge.getLastId()) ?? (await bridge.list())[0]?.id;
    const loaded = lastId ? await bridge.load(lastId) : null;
    if (loaded) {
      blankRef.current = false;
      setNote(loaded);
    } else {
      await newNote();
    }
  }, [note, newNote]);

  // Commands from the native hotkeys.
  useEffect(() => {
    window.afterThought = {
      command: (name) => {
        if (name === "toggleSidebar") return setSidebarOpen((o) => !o);
        setSwitcherOpen(false);
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
      try {
        setToast(await copyNotes(target, format, notes, folders, liveRef.current));
      } catch {
        setToast("Couldn’t copy that. Try again?");
      }
    },
    [notes, folders],
  );

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
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
        setSwitcherOpen(false);
        newNote();
      } else if (e.metaKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setSwitcherOpen((o) => !o);
      } else if (e.metaKey && (e.code === "Backslash" || e.key === "\\")) {
        e.preventDefault();
        setSidebarOpen((o) => !o);
      } else if (e.key === "Escape" && !e.defaultPrevented && !switcherOpen) {
        // Let BlockNote close its own menus first.
        if (document.querySelector(".bn-suggestion-menu")) return;
        bridge.hide();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newNote, switcherOpen, setSidebarOpen, note, copy]);

  const deleteNote = async (id: string) => {
    await bridge.remove(id);
    setNotes((ns) => ns.filter((n) => n.id !== id));
    if (id === note?.id) {
      blankRef.current = false;
      setNote(null);
      newNote();
    }
  };

  const moveNote = async (id: string, folderId: string | null) => {
    await bridge.move(id, folderId);
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, folderId } : n)));
    if (id === note?.id) setNote({ ...note, folderId });
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
    if (note?.folderId === id) setNote({ ...note, folderId: null });
    refresh();
  };

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
          <kbd>/</kbd> blocks <kbd>⌘P</kbd> notes <kbd>⌘T</kbd> new <kbd>esc</kbd> hide
        </span>
      </header>
      <div className="body">
        {sidebarOpen && (
          <Sidebar
            notes={notes}
            folders={folders}
            currentId={note?.id}
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
        {note && (
          <Editor
            key={note.id}
            note={note}
            focusTick={focusTick}
            onChange={(title, empty, blocks) => {
              blankRef.current = empty;
              liveRef.current = { id: note.id, blocks };
              setNote((n) => (n ? { ...n, title } : n));
              if (empty) return;
              // Keep the sidebar in step without re-reading every file.
              setNotes((ns) => {
                const meta = { id: note.id, title, updatedAt: Date.now(), folderId: note.folderId };
                const rest = ns.filter((n) => n.id !== note.id);
                return [meta, ...rest];
              });
            }}
          />
        )}
      </div>
      {toast && (
        <div className="toast" role="status">
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {toast}
        </div>
      )}
      {switcherOpen && (
        <Switcher
          currentId={note?.id}
          onPick={(id) => {
            setSwitcherOpen(false);
            openNote(id);
          }}
          folders={folders}
          onDeleted={(id) => {
            setNotes((ns) => ns.filter((n) => n.id !== id));
            if (id === note?.id) {
              blankRef.current = false;
              setNote(null);
              setSwitcherOpen(false);
              newNote();
            }
          }}
          onClose={() => {
            setSwitcherOpen(false);
            setFocusTick((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}

function Editor({
  note,
  focusTick,
  onChange,
}: {
  note: Note;
  focusTick: number;
  onChange: (title: string, empty: boolean, blocks: Block[]) => void;
}) {
  const editor = useCreateBlockNote({
    initialContent: note.content
      ? (JSON.parse(note.content) as PartialBlock[])
      : undefined,
  });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    editor.focus();
  }, [editor, focusTick]);

  // Menus (e.g. the block menu's Colors) take focus and don't hand it back, so
  // ⌘Z would land on <body> and do nothing. Route undo/redo to the editor then.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
      />
    </div>
  );
}
