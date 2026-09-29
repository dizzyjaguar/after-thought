import Foundation

/// Notes are plain JSON files in ~/Library/Application Support/after-thought/notes.
/// Folders are a flat list in after-thought/folders.json; a note points at its folder by id.
final class NoteStore {
    struct Note: Codable {
        var id: String
        var title: String
        var updatedAt: Double   // ms since 1970, matches JS Date.now()
        var content: String     // BlockNote blocks as JSON
        var folderId: String?   // nil = not in a folder
        var markdown: String?   // readable copy for the Markdown mirror; nil until the web view sends it
    }

    struct Folder: Codable {
        var id: String
        var name: String
    }

    let dir: URL
    let root: URL
    private let foldersFile: URL
    /// Called after anything changes, so the Markdown mirror can catch up.
    var onChange: (() -> Void)?
    private let lastIdKey = "lastNoteId"

    init(root: URL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("after-thought", isDirectory: true)) {
        self.root = root
        dir = root.appendingPathComponent("notes", isDirectory: true)
        foldersFile = root.appendingPathComponent("folders.json")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    private static func isValidId(_ id: String) -> Bool {
        // Ids come from the web view; only allow uuid-ish names so nothing escapes the folder.
        id.range(of: "^[A-Za-z0-9-]{1,64}$", options: .regularExpression) != nil
    }

    private func url(_ id: String) -> URL? {
        guard Self.isValidId(id) else { return nil }
        return dir.appendingPathComponent("\(id).json")
    }

    private func read(_ id: String) -> Note? {
        guard let url = url(id), let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Note.self, from: data)
    }

    private func write(_ note: Note) -> Bool {
        guard let url = url(note.id), let data = try? JSONEncoder().encode(note) else { return false }
        let ok = (try? data.write(to: url, options: .atomic)) != nil
        if ok { onChange?() }
        return ok
    }

    func allNotes() -> [Note] {
        let files = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        return files
            .filter { $0.pathExtension == "json" }
            .compactMap { try? JSONDecoder().decode(Note.self, from: Data(contentsOf: $0)) }
    }

    private static func meta(_ note: Note) -> [String: Any] {
        ["id": note.id, "title": note.title, "updatedAt": note.updatedAt, "folderId": note.folderId ?? NSNull()]
    }

    func list() -> [[String: Any]] {
        allNotes().sorted { $0.updatedAt > $1.updatedAt }.map(Self.meta)
    }

    func load(_ id: String) -> [String: Any]? {
        guard let note = read(id) else { return nil }
        var result = Self.meta(note)
        result["content"] = note.content
        return result
    }

    /// `folderId` only applies when the note is first created; after that, use `move`.
    func save(id: String, title: String, content: String, folderId: String?, markdown: String?) -> Bool {
        let existing = read(id)
        return write(Note(id: id, title: title, updatedAt: Date().timeIntervalSince1970 * 1000,
                          content: content, folderId: existing != nil ? existing?.folderId : folderId,
                          markdown: markdown ?? existing?.markdown))
    }

    /// Notes saved before the Markdown mirror existed have no Markdown yet.
    func idsMissingMarkdown() -> [String] {
        allNotes().filter { $0.markdown == nil && !$0.content.isEmpty }.map(\.id)
    }

    func setMarkdown(id: String, markdown: String) -> Bool {
        guard var note = read(id) else { return false }
        note.markdown = markdown
        return write(note)
    }

    func move(id: String, folderId: String?) -> Bool {
        guard var note = read(id) else { return false }
        note.folderId = folderId
        return write(note)
    }

    // MARK: Folders

    func folders() -> [[String: Any]] {
        loadFolders().map { ["id": $0.id, "name": $0.name] }
    }

    func loadFolders() -> [Folder] {
        guard let data = try? Data(contentsOf: foldersFile) else { return [] }
        return (try? JSONDecoder().decode([Folder].self, from: data)) ?? []
    }

    func saveFolders(_ raw: [[String: Any]]) -> Bool {
        let folders = raw.compactMap { dict -> Folder? in
            guard let id = dict["id"] as? String, Self.isValidId(id), let name = dict["name"] as? String else { return nil }
            return Folder(id: id, name: name)
        }
        guard let data = try? JSONEncoder().encode(folders) else { return false }
        let ok = (try? data.write(to: foldersFile, options: .atomic)) != nil
        if ok { onChange?() }
        return ok
    }

    /// Removes the folder; its notes stay, just without a folder.
    func deleteFolder(_ id: String) -> Bool {
        for var note in allNotes() where note.folderId == id {
            note.folderId = nil
            _ = write(note)
        }
        return saveFolders(folders().filter { $0["id"] as? String != id })
    }

    func delete(_ id: String) -> Bool {
        guard let url = url(id) else { return false }
        try? FileManager.default.removeItem(at: url)
        onChange?()
        return true
    }

    var lastId: String? {
        get { UserDefaults.standard.string(forKey: lastIdKey) }
        set { UserDefaults.standard.set(newValue, forKey: lastIdKey) }
    }
}
