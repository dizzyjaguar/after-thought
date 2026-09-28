// Talks to the native Swift shell. Falls back to localStorage in a normal
// browser so `npm run dev` works without the Mac app.

export type NoteMeta = { id: string; title: string; updatedAt: number };
export type Note = NoteMeta & { content: string };

type Message =
  | { type: "list" }
  | { type: "load"; id: string }
  | { type: "save"; id: string; title: string; content: string }
  | { type: "delete"; id: string }
  | { type: "getLastId" }
  | { type: "setLastId"; id: string }
  | { type: "hide" };

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        bridge?: { postMessage: (msg: Message) => Promise<unknown> };
      };
    };
    afterThought?: { command: (name: "new" | "last") => void };
  }
}

const native = window.webkit?.messageHandlers?.bridge;

function send<T>(msg: Message): Promise<T> {
  if (native) return native.postMessage(msg) as Promise<T>;
  return Promise.resolve(browserFallback(msg) as T);
}

function browserFallback(msg: Message): unknown {
  const read = (): Record<string, Note> =>
    JSON.parse(localStorage.getItem("at:notes") ?? "{}");
  const write = (notes: Record<string, Note>) =>
    localStorage.setItem("at:notes", JSON.stringify(notes));

  switch (msg.type) {
    case "list":
      return Object.values(read())
        .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    case "load":
      return read()[msg.id] ?? null;
    case "save": {
      const notes = read();
      notes[msg.id] = { ...msg, updatedAt: Date.now() };
      write(notes);
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
    case "hide":
      return true;
  }
}

export const bridge = {
  list: () => send<NoteMeta[]>({ type: "list" }),
  load: (id: string) => send<Note | null>({ type: "load", id }),
  save: (id: string, title: string, content: string) =>
    send<boolean>({ type: "save", id, title, content }),
  remove: (id: string) => send<boolean>({ type: "delete", id }),
  getLastId: () => send<string | null>({ type: "getLastId" }),
  setLastId: (id: string) => send<boolean>({ type: "setLastId", id }),
  hide: () => send<boolean>({ type: "hide" }),
};
