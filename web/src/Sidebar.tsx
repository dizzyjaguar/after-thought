import { useEffect, useState } from "react";
import type { Folder, NoteMeta } from "./bridge";

const DRAG_TYPE = "application/x-after-thought-note";
const MIN_WIDTH = 160;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 230;

function loadWidth(): number {
  try {
    const w = Number(localStorage.getItem("at:sidebarWidth"));
    return w >= MIN_WIDTH && w <= MAX_WIDTH ? w : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

// Per-viewer UI memory; storage can be unavailable, so never let it throw.
function loadSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set();
  }
}
function saveSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

const Icon = {
  chevron: (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.5h5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  folderPlus: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.5h5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 7v4M6 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  note: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d="M4 2.5h5.5L12.5 5.5v8H4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6 8h4.5M6 10.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/** A trash button that needs two clicks: the first arms it, the second deletes. */
function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 2500);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={`sb-icon ${armed ? "armed" : ""}`}
      title={armed ? "Click again to delete" : label}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) onConfirm();
        else setArmed(true);
      }}
    >
      {armed ? "Delete?" : Icon.trash}
    </button>
  );
}

export function Sidebar({
  notes,
  folders,
  currentId,
  renamingId,
  onOpen,
  onNewNote,
  onDeleteNote,
  onMove,
  onNewFolder,
  onRenameFolder,
  onDeleteFolder,
  onRenameDone,
}: {
  notes: NoteMeta[];
  folders: Folder[];
  currentId?: string;
  /** Folder whose name is being edited (set right after creating one). */
  renamingId: string | null;
  onOpen: (id: string) => void;
  onNewNote: (folderId: string | null) => void;
  onDeleteNote: (id: string) => void;
  onMove: (noteId: string, folderId: string | null) => void;
  onNewFolder: () => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameDone: () => void;
}) {
  const [collapsed, setCollapsed] = useState(() => loadSet("at:collapsed"));
  const [editing, setEditing] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null); // folder id, or "" for loose
  const [width, setWidth] = useState(loadWidth);
  const [resizing, setResizing] = useState(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    let latest = startWidth;
    setResizing(true);
    const onMove = (ev: MouseEvent) => {
      latest = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + ev.clientX - startX));
      setWidth(latest);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setResizing(false);
      try {
        localStorage.setItem("at:sidebarWidth", String(latest));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    if (renamingId) setEditing(renamingId);
  }, [renamingId]);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveSet("at:collapsed", next);
      return next;
    });
  };

  const dropProps = (folderId: string | null) => {
    const key = folderId ?? "";
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTarget(key);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
      },
      onDrop: (e: React.DragEvent) => {
        const id = e.dataTransfer.getData(DRAG_TYPE);
        setDropTarget(null);
        if (!id) return;
        e.preventDefault();
        e.stopPropagation();
        onMove(id, folderId);
        if (folderId && collapsed.has(folderId)) toggle(folderId);
      },
    };
  };

  const noteRow = (n: NoteMeta, nested: boolean) => (
    <div
      key={n.id}
      className={`sb-row sb-note ${nested ? "nested" : ""} ${n.id === currentId ? "active" : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, n.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => setDropTarget(null)}
      onClick={() => onOpen(n.id)}
    >
      <span className="sb-glyph">{Icon.note}</span>
      <span className="sb-label">{n.title || "Untitled"}</span>
      <span className="sb-actions">
        <DeleteButton label="Delete note" onConfirm={() => onDeleteNote(n.id)} />
      </span>
    </div>
  );

  const loose = notes.filter((n) => !n.folderId || !folders.some((f) => f.id === n.folderId));

  return (
    <aside className={`sidebar ${resizing ? "resizing" : ""}`} style={{ width }}>
      <div
        className="sb-resize"
        title="Drag to resize · double-click to reset"
        onMouseDown={startResize}
        onDoubleClick={() => {
          setWidth(DEFAULT_WIDTH);
          try {
            localStorage.removeItem("at:sidebarWidth");
          } catch {
            /* ignore */
          }
        }}
      />
      <div className="sb-head">
        <span>Notes</span>
        <span className="sb-head-actions">
          <button className="sb-icon" title="New folder" onClick={onNewFolder}>
            {Icon.folderPlus}
          </button>
          <button className="sb-icon" title="New note (⌘T)" onClick={() => onNewNote(null)}>
            {Icon.plus}
          </button>
        </span>
      </div>

      <div className="sb-scroll">
        {folders.map((f) => {
          const open = !collapsed.has(f.id);
          const inside = notes.filter((n) => n.folderId === f.id);
          return (
            <div key={f.id} className={`sb-folder ${dropTarget === f.id ? "drop" : ""}`} {...dropProps(f.id)}>
              <div className="sb-row" onClick={() => toggle(f.id)}>
                <span className={`sb-chevron ${open ? "open" : ""}`}>{Icon.chevron}</span>
                <span className="sb-glyph">{Icon.folder}</span>
                {editing === f.id ? (
                  <input
                    className="sb-rename"
                    autoFocus
                    defaultValue={f.name}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") {
                        e.preventDefault();
                        e.currentTarget.value = f.name;
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={(e) => {
                      const name = e.currentTarget.value.trim();
                      if (name && name !== f.name) onRenameFolder(f.id, name);
                      setEditing(null);
                      onRenameDone();
                    }}
                  />
                ) : (
                  <span
                    className="sb-label"
                    title="Double-click to rename"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditing(f.id);
                    }}
                  >
                    {f.name}
                  </span>
                )}
                <span className="sb-count">{inside.length || ""}</span>
                <span className="sb-actions">
                  <button
                    className="sb-icon"
                    title="New note in folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!open) toggle(f.id);
                      onNewNote(f.id);
                    }}
                  >
                    {Icon.plus}
                  </button>
                  <DeleteButton label="Delete folder (keeps notes)" onConfirm={() => onDeleteFolder(f.id)} />
                </span>
              </div>
              {open && inside.map((n) => noteRow(n, true))}
              {open && !inside.length && <div className="sb-empty nested">Drop notes here</div>}
            </div>
          );
        })}

        <div className={`sb-loose ${dropTarget === "" ? "drop" : ""}`} {...dropProps(null)}>
          {folders.length > 0 && loose.length > 0 && <div className="sb-divider" />}
          {loose.map((n) => noteRow(n, false))}
          {!notes.length && <div className="sb-empty">No notes yet</div>}
        </div>
      </div>
    </aside>
  );
}

/** Small hook: the sidebar's open/closed state, remembered between launches. */
export function useSidebarOpen(): [boolean, (fn: (open: boolean) => boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("at:sidebar") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("at:sidebar", open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);
  return [open, setOpen];
}
