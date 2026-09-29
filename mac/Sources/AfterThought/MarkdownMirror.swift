import AppKit

/// Keeps a readable, one-way Markdown copy of every note in a folder the user picks:
/// `<folder>/<Folder name>/<Note title>.md`, loose notes at the top.
/// It only ever deletes files it wrote itself (tracked in a manifest).
final class MarkdownMirror {
    private let store: NoteStore
    private let manifestFile: URL
    private let rootKey = "markdownMirrorRoot"
    private var pending: DispatchWorkItem?

    private struct Manifest: Codable {
        var root: String
        var paths: [String] // relative to root
    }

    init(store: NoteStore) {
        self.store = store
        manifestFile = store.root.appendingPathComponent("mirror-manifest.json")
    }

    /// nil when the mirror is off.
    var rootURL: URL? {
        get { UserDefaults.standard.url(forKey: rootKey) }
        set {
            UserDefaults.standard.set(newValue, forKey: rootKey)
            scheduleSync()
        }
    }

    /// Batches bursts of changes (typing saves every few hundred ms).
    func scheduleSync() {
        pending?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.sync() }
        pending = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }

    func sync() {
        guard let root = rootURL else { return }
        let fm = FileManager.default
        try? fm.createDirectory(at: root, withIntermediateDirectories: true)

        let folderNames = Dictionary(uniqueKeysWithValues: store.loadFolders().map { ($0.id, $0.name) })
        var desired: [String: String] = [:]
        var taken = Set<String>() // lowercased: the Mac's disk ignores case

        // Sorted by id so duplicate titles get the same " 2" suffix every time.
        for note in store.allNotes().sorted(by: { $0.id < $1.id }) {
            guard let markdown = note.markdown, !markdown.isEmpty else { continue }
            let folder = note.folderId.flatMap { folderNames[$0] }.map(Self.safeName)
            let base = Self.safeName(note.title)
            var path = [folder, "\(base).md"].compactMap { $0 }.joined(separator: "/")
            var n = 2
            while taken.contains(path.lowercased()) {
                path = [folder, "\(base) \(n).md"].compactMap { $0 }.joined(separator: "/")
                n += 1
            }
            taken.insert(path.lowercased())
            desired[path] = markdown + "\n"
        }

        for (path, text) in desired {
            let url = root.appendingPathComponent(path)
            if (try? String(contentsOf: url, encoding: .utf8)) == text { continue }
            try? fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? text.write(to: url, atomically: true, encoding: .utf8)
        }

        // Remove files we wrote earlier that no note maps to anymore, then any folder that emptied.
        let old = loadManifest()
        if old?.root == root.path {
            for path in old?.paths ?? [] where desired[path] == nil {
                let url = root.appendingPathComponent(path)
                try? fm.removeItem(at: url)
                let parent = url.deletingLastPathComponent()
                if parent.path != root.path,
                   (try? fm.contentsOfDirectory(atPath: parent.path))?.filter({ $0 != ".DS_Store" }).isEmpty == true {
                    try? fm.removeItem(at: parent)
                }
            }
        }
        saveManifest(Manifest(root: root.path, paths: desired.keys.sorted()))
    }

    /// A title as a file or folder name: no path separators or control characters.
    static func safeName(_ title: String) -> String {
        let banned = CharacterSet(charactersIn: "/:\\").union(.newlines).union(.controlCharacters)
        var name = String(String.UnicodeScalarView(title.unicodeScalars.map { banned.contains($0) ? "-" : $0 }))
            .trimmingCharacters(in: .whitespaces)
        while name.hasPrefix(".") { name.removeFirst() }
        if name.count > 100 { name = String(name.prefix(100)) }
        return name.isEmpty ? "Untitled" : name
    }

    private func loadManifest() -> Manifest? {
        guard let data = try? Data(contentsOf: manifestFile) else { return nil }
        return try? JSONDecoder().decode(Manifest.self, from: data)
    }

    private func saveManifest(_ manifest: Manifest) {
        guard let data = try? JSONEncoder().encode(manifest) else { return }
        try? data.write(to: manifestFile, options: .atomic)
    }

    // MARK: Choosing the folder

    /// Asks where to keep the copy. Returns false if the user cancelled.
    @discardableResult
    func chooseFolder() -> Bool {
        let panel = NSOpenPanel()
        panel.title = "Keep a Markdown Copy"
        panel.message = "Pick where to keep it. An “After Thought” folder is made inside."
        panel.prompt = "Choose"
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.canCreateDirectories = true
        panel.directoryURL = rootURL?.deletingLastPathComponent()
            ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        NSApp.activate(ignoringOtherApps: true)
        guard panel.runModal() == .OK, let picked = panel.url else { return false }
        rootURL = picked.lastPathComponent == "After Thought"
            ? picked
            : picked.appendingPathComponent("After Thought", isDirectory: true)
        return true
    }
}
