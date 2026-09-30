import XCTest
@testable import AfterThought

final class NoteStoreTests: XCTestCase {
    private var root: URL!
    private var store: NoteStore!

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("after-thought-tests-\(UUID().uuidString)", isDirectory: true)
        store = NoteStore(root: root)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root)
    }

    func testSaveThenLoad() {
        XCTAssertTrue(store.save(id: "a", title: "Paint", content: "[1]", folderId: nil, markdown: "# Paint"))
        let note = store.load("a")
        XCTAssertEqual(note?["title"] as? String, "Paint")
        XCTAssertEqual(note?["content"] as? String, "[1]")
        XCTAssertTrue(note?["folderId"] is NSNull)
    }

    func testListIsNewestFirst() {
        _ = store.save(id: "old", title: "Old", content: "[]", folderId: nil, markdown: nil)
        Thread.sleep(forTimeInterval: 0.01)
        _ = store.save(id: "new", title: "New", content: "[]", folderId: nil, markdown: nil)
        XCTAssertEqual(store.list().map { $0["id"] as? String }, ["new", "old"])
    }

    func testFolderOnlyAppliesWhenANoteIsCreated() {
        _ = store.save(id: "a", title: "A", content: "[]", folderId: "f1", markdown: nil)
        // A later save (e.g. from a stale editor) must not move the note.
        _ = store.save(id: "a", title: "A", content: "[]", folderId: "f2", markdown: nil)
        XCTAssertEqual(store.load("a")?["folderId"] as? String, "f1")

        XCTAssertTrue(store.move(id: "a", folderId: "f2"))
        XCTAssertEqual(store.load("a")?["folderId"] as? String, "f2")
    }

    func testSaveKeepsMarkdownWhenNoneIsSent() {
        _ = store.save(id: "a", title: "A", content: "[]", folderId: nil, markdown: "# A")
        _ = store.save(id: "a", title: "A", content: "[]", folderId: nil, markdown: nil)
        XCTAssertEqual(store.allNotes().first?.markdown, "# A")
    }

    func testDeletingAFolderKeepsItsNotes() {
        _ = store.saveFolders([["id": "f1", "name": "Home"], ["id": "f2", "name": "Work"]])
        _ = store.save(id: "a", title: "A", content: "[]", folderId: "f1", markdown: nil)

        XCTAssertTrue(store.deleteFolder("f1"))

        XCTAssertEqual(store.folders().map { $0["id"] as? String }, ["f2"])
        XCTAssertNotNil(store.load("a"))
        XCTAssertTrue(store.load("a")?["folderId"] is NSNull)
    }

    func testDeleteNote() {
        _ = store.save(id: "a", title: "A", content: "[]", folderId: nil, markdown: nil)
        XCTAssertTrue(store.delete("a"))
        XCTAssertNil(store.load("a"))
    }

    func testIdsMissingMarkdown() {
        _ = store.save(id: "old", title: "Old", content: "[1]", folderId: nil, markdown: nil)
        _ = store.save(id: "new", title: "New", content: "[1]", folderId: nil, markdown: "# New")
        XCTAssertEqual(store.idsMissingMarkdown(), ["old"])

        XCTAssertTrue(store.setMarkdown(id: "old", markdown: "# Old"))
        XCTAssertEqual(store.idsMissingMarkdown(), [])
    }

    /// Ids come from the web view, so a crafted one must not reach files outside the notes folder.
    func testRejectsIdsThatCouldEscapeTheNotesFolder() {
        for bad in ["../evil", "a/b", "", "..", String(repeating: "a", count: 65)] {
            XCTAssertFalse(store.save(id: bad, title: "x", content: "[]", folderId: nil, markdown: nil), bad)
            XCTAssertNil(store.load(bad), bad)
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: root.appendingPathComponent("evil.json").path))

        _ = store.saveFolders([["id": "../x", "name": "Bad"], ["id": "ok", "name": "Good"]])
        XCTAssertEqual(store.folders().map { $0["id"] as? String }, ["ok"])
    }

    func testChangesNotifyListeners() {
        var calls = 0
        store.onChange = { calls += 1 }
        _ = store.save(id: "a", title: "A", content: "[]", folderId: nil, markdown: nil)
        _ = store.move(id: "a", folderId: "f")
        _ = store.saveFolders([])
        _ = store.delete("a")
        XCTAssertEqual(calls, 4)
    }
}
