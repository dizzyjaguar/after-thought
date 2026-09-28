import { useEffect, useMemo, useRef, useState } from "react";
import { bridge, type NoteMeta } from "./bridge";

function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// Raycast-style quick switcher: type to filter, ↑↓ to move, ↵ to open, ⌘⌫ to delete.
export function Switcher({
  currentId,
  onPick,
  onDeleted,
  onClose,
}: {
  currentId?: string;
  onPick: (id: string) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    bridge.list().then(setNotes);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? notes.filter((n) => (n.title || "untitled").toLowerCase().includes(q)) : notes;
  }, [notes, query]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    listRef.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const onKey = async (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[index];
      if (pick) onPick(pick.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Backspace" && e.metaKey) {
      e.preventDefault();
      const target = filtered[index];
      if (!target) return;
      await bridge.remove(target.id);
      setNotes((ns) => ns.filter((n) => n.id !== target.id));
      onDeleted(target.id);
    }
  };

  return (
    <div className="switcher-backdrop" onMouseDown={onClose}>
      <div className="switcher" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder="Search notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <ul ref={listRef}>
          {filtered.map((n, i) => (
            <li
              key={n.id}
              className={i === index ? "active" : ""}
              onMouseEnter={() => setIndex(i)}
              onClick={() => onPick(n.id)}
            >
              <span>
                {n.title || "Untitled"}
                {n.id === currentId && <em> · open</em>}
              </span>
              <time>{ago(n.updatedAt)}</time>
            </li>
          ))}
          {!filtered.length && <li className="empty">No notes</li>}
        </ul>
        <footer>
          <kbd>↵</kbd> open <kbd>⌘⌫</kbd> delete <kbd>esc</kbd> close
        </footer>
      </div>
    </div>
  );
}
