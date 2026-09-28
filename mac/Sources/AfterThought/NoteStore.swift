import Foundation

/// Notes are plain JSON files in ~/Library/Application Support/after-thought/notes.
final class NoteStore {
    struct Note: Codable {
        var id: String
        var title: String
        var updatedAt: Double // ms since 1970, matches JS Date.now()
        var content: String   // BlockNote blocks as JSON
    }

    let dir: URL
    private let lastIdKey = "lastNoteId"

    init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        dir = base.appendingPathComponent("after-thought/notes", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    private func url(_ id: String) -> URL? {
        // Ids come from the web view; only allow uuid-ish names so nothing escapes the folder.
        guard id.range(of: "^[A-Za-z0-9-]{1,64}$", options: .regularExpression) != nil else { return nil }
        return dir.appendingPathComponent("\(id).json")
    }

    func list() -> [[String: Any]] {
        let files = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        return files
            .filter { $0.pathExtension == "json" }
            .compactMap { try? JSONDecoder().decode(Note.self, from: Data(contentsOf: $0)) }
            .sorted { $0.updatedAt > $1.updatedAt }
            .map { ["id": $0.id, "title": $0.title, "updatedAt": $0.updatedAt] }
    }

    func load(_ id: String) -> [String: Any]? {
        guard let url = url(id), let data = try? Data(contentsOf: url),
              let note = try? JSONDecoder().decode(Note.self, from: data) else { return nil }
        return ["id": note.id, "title": note.title, "updatedAt": note.updatedAt, "content": note.content]
    }

    func save(id: String, title: String, content: String) -> Bool {
        guard let url = url(id) else { return false }
        let note = Note(id: id, title: title, updatedAt: Date().timeIntervalSince1970 * 1000, content: content)
        guard let data = try? JSONEncoder().encode(note) else { return false }
        return (try? data.write(to: url, options: .atomic)) != nil
    }

    func delete(_ id: String) -> Bool {
        guard let url = url(id) else { return false }
        try? FileManager.default.removeItem(at: url)
        return true
    }

    var lastId: String? {
        get { UserDefaults.standard.string(forKey: lastIdKey) }
        set { UserDefaults.standard.set(newValue, forKey: lastIdKey) }
    }
}
