// Talks to the native Swift shell. Falls back to localStorage in a normal
// browser so `npm run dev` works without the Mac app.

export type NoteMeta = {
  id: string;
  title: string;
  updatedAt: number;
  folderId: string | null;
};
export type Note = NoteMeta & { content: string };
export type Folder = { id: string; name: string };

type Message =
  | { type: "list" }
  | { type: "load"; id: string }
  | {
      type: "save";
      id: string;
      title: string;
      content: string;
      folderId: string | null;
      markdown: string;
    }
  | { type: "idsMissingMarkdown" }
  | { type: "setMarkdown"; id: string; markdown: string }
  | { type: "delete"; id: string }
  | { type: "move"; id: string; folderId: string | null }
  | { type: "folders" }
  | { type: "saveFolders"; folders: Folder[] }
  | { type: "deleteFolder"; id: string }
  | { type: "getLastId" }
  | { type: "setLastId"; id: string }
  | { type: "copy"; text: string }
  | { type: "copyFile"; name: string; text: string }
  | { type: "hide" };

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        bridge?: { postMessage: (msg: Message) => Promise<unknown> };
      };
    };
    afterThought?: { command: (name: "new" | "last" | "toggleSidebar") => void };
  }
}

const native = window.webkit?.messageHandlers?.bridge;

function send<T>(msg: Message): Promise<T> {
  if (native) return native.postMessage(msg) as Promise<T>;
  // A browser can't put a file on the clipboard, so copyFile falls back to text.
  if (msg.type === "copy" || msg.type === "copyFile") {
    return navigator.clipboard.writeText(msg.text).then(() => true as T);
  }
  return Promise.resolve(browserFallback(msg) as T);
}

function browserFallback(msg: Message): unknown {
  const read = (): Record<string, Note> =>
    JSON.parse(localStorage.getItem("at:notes") ?? "{}");
  const write = (notes: Record<string, Note>) =>
    localStorage.setItem("at:notes", JSON.stringify(notes));
  const readFolders = (): Folder[] =>
    JSON.parse(localStorage.getItem("at:folders") ?? "[]");
  const writeFolders = (folders: Folder[]) =>
    localStorage.setItem("at:folders", JSON.stringify(folders));

  switch (msg.type) {
    case "list":
      return Object.values(read())
        .map(({ id, title, updatedAt, folderId }) => ({
          id,
          title,
          updatedAt,
          folderId: folderId ?? null,
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    case "load":
      return read()[msg.id] ?? null;
    case "save": {
      const notes = read();
      const folderId = notes[msg.id] ? notes[msg.id].folderId : msg.folderId;
      notes[msg.id] = {
        id: msg.id,
        title: msg.title,
        content: msg.content,
        folderId,
        updatedAt: Date.now(),
      };
      write(notes);
      return true;
    }
    case "move": {
      const notes = read();
      if (!notes[msg.id]) return false;
      notes[msg.id].folderId = msg.folderId;
      write(notes);
      return true;
    }
    case "folders":
      return readFolders();
    case "saveFolders":
      writeFolders(msg.folders);
      return true;
    case "deleteFolder": {
      const notes = read();
      for (const n of Object.values(notes)) if (n.folderId === msg.id) n.folderId = null;
      write(notes);
      writeFolders(readFolders().filter((f) => f.id !== msg.id));
      return true;
    }
    case "delete": {
      const notes = read();
      delete notes[msg.id];
      write(notes);
      return true;
    }
    case "getLastId":
      return localStorage.getItem("at:last");
    case "setLastId":
      localStorage.setItem("at:last", msg.id);
      return true;
    // The Markdown mirror only exists in the Mac app.
    case "idsMissingMarkdown":
      return [];
    case "hide":
    case "copy":
    case "copyFile":
    case "setMarkdown":
      return true;
  }
}

export const bridge = {
  list: () => send<NoteMeta[]>({ type: "list" }),
  load: (id: string) => send<Note | null>({ type: "load", id }),
  /** `folderId` only counts when the note is first created; use `move` after. */
  save: (id: string, title: string, content: string, folderId: string | null, markdown: string) =>
    send<boolean>({ type: "save", id, title, content, folderId, markdown }),
  idsMissingMarkdown: () => send<string[]>({ type: "idsMissingMarkdown" }),
  setMarkdown: (id: string, markdown: string) =>
    send<boolean>({ type: "setMarkdown", id, markdown }),
  move: (id: string, folderId: string | null) =>
    send<boolean>({ type: "move", id, folderId }),
  folders: () => send<Folder[]>({ type: "folders" }),
  saveFolders: (folders: Folder[]) => send<boolean>({ type: "saveFolders", folders }),
  deleteFolder: (id: string) => send<boolean>({ type: "deleteFolder", id }),
  remove: (id: string) => send<boolean>({ type: "delete", id }),
  getLastId: () => send<string | null>({ type: "getLastId" }),
  setLastId: (id: string) => send<boolean>({ type: "setLastId", id }),
  hide: () => send<boolean>({ type: "hide" }),
  /** Puts plain text on the system clipboard. */
  copy: (text: string) => send<boolean>({ type: "copy", text }),
  /** Saves `text` as a file called `name` and puts that file on the clipboard. */
  copyFile: (name: string, text: string) => send<boolean>({ type: "copyFile", name, text }),
};
