# after-thought

Quick notes for macOS. Notion-style blocks (via [BlockNote](https://www.blocknotejs.org)) in a Raycast-style floating Liquid Glass panel.

## Shortcuts

| Keys | What |
| --- | --- |
| `⌘⇧Space` | Show / hide, opens your last note |
| `⌃⌥N` | New note |
| `/` | Block menu (headings, lists, checklists, code, …) |
| `⌘P` | Search notes (`⌘⌫` deletes the selected one) |
| `⌘Z` / `⌘⇧Z` | Undo / redo (last 100 changes) |
| `⌘N` / `⌘T` | New note (inside the panel) |
| `esc` | Hide |

## Build

```bash
./scripts/build.sh
open build/after-thought.app
```

Needs Node and Xcode. The app lives in the menu bar (no Dock icon).

## Layout

- `web/` — React + BlockNote editor (Vite)
- `mac/` — Swift app: floating panel, global hotkeys, menu bar, file storage
- Notes are saved as JSON in `~/Library/Application Support/after-thought/notes/`

## Dev

Run the editor with hot reload, then point the app at it:

```bash
npm --prefix web run dev
AFTER_THOUGHT_DEV_URL=http://localhost:5173 build/after-thought.app/Contents/MacOS/AfterThought
```
