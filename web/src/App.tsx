import { useCallback, useEffect, useRef, useState } from "react";
import type { Block, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { bridge, type Note } from "./bridge";
import { Switcher } from "./Switcher";

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
  // Tracks whether the open note is still blank, so we can drop it when leaving.
  const blankRef = useRef(true);

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

  const newNote = useCallback(async () => {
    if (note && blankRef.current) return setFocusTick((t) => t + 1);
    await leaveCurrent();
    const fresh: Note = { id: newId(), title: "", content: "", updatedAt: Date.now() };
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
        setSwitcherOpen(false);
        if (name === "new") newNote();
        else openLast();
      },
    };
  }, [newNote, openLast]);

  useEffect(() => {
    openLast();
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // App-level shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setSwitcherOpen(false);
        newNote();
      } else if (e.metaKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setSwitcherOpen((o) => !o);
      } else if (e.key === "Escape" && !e.defaultPrevented && !switcherOpen) {
        // Let BlockNote close its own menus first.
        if (document.querySelector(".bn-suggestion-menu")) return;
        bridge.hide();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newNote, switcherOpen]);

  return (
    <div className="shell">
      <header className="bar">
        <span className="title">{note?.title || "Untitled"}</span>
        <span className="hints">
          <kbd>/</kbd> blocks <kbd>⌘P</kbd> notes <kbd>⌘N</kbd> new <kbd>esc</kbd> hide
        </span>
      </header>
      {note && (
        <Editor
          key={note.id}
          note={note}
          focusTick={focusTick}
          onChange={(title, empty) => {
            blankRef.current = empty;
            setNote((n) => (n ? { ...n, title } : n));
          }}
        />
      )}
      {switcherOpen && (
        <Switcher
          currentId={note?.id}
          onPick={(id) => {
            setSwitcherOpen(false);
            openNote(id);
          }}
          onDeleted={(id) => {
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
  onChange: (title: string, empty: boolean) => void;
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
          onChange(title, empty);
          window.clearTimeout(timer.current);
          const save = () => {
            pending.current = null;
            if (!empty) bridge.save(note.id, title, JSON.stringify(blocks));
          };
          pending.current = save;
          timer.current = window.setTimeout(save, 300);
        }}
      />
    </div>
  );
}
