import XCTest
@testable import AfterThought

final class MarkdownMirrorTests: XCTestCase {
    private var root: URL!
    private var out: URL!
    private var store: NoteStore!
    private var defaults: UserDefaults!
    private var mirror: MarkdownMirror!
    private let suite = "after-thought-tests-\(UUID().uuidString)"

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("after-thought-tests-\(UUID().uuidString)", isDirectory: true)
        out = root.appendingPathComponent("mirror/After Thought", isDirectory: true)
        store = NoteStore(root: root.appendingPathComponent("data"))
        defaults = UserDefaults(suiteName: suite)
        mirror = MarkdownMirror(store: store, defaults: defaults)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root)
        defaults.removePersistentDomain(forName: suite)
    }

    private func files() -> [String] {
        let all = FileManager.default.enumerator(atPath: out.path)?.allObjects as? [String] ?? []
        return all.sorted()
    }

    private func read(_ path: String) -> String? {
        try? String(contentsOf: out.appendingPathComponent(path), encoding: .utf8)
    }

    func testOffByDefaultAndWritesNothing() {
        _ = store.save(id: "a", title: "A", content: "[]", folderId: nil, markdown: "A")
        XCTAssertNil(mirror.rootURL)
        mirror.sync()
        XCTAssertEqual(files(), [])
    }

    func testWritesNotesIntoFolders() {
        _ = store.saveFolders([["id": "f1", "name": "Home projects"]])
        _ = store.save(id: "a", title: "Paint colors", content: "[]", folderId: "f1", markdown: "# Paint colors")
        _ = store.save(id: "b", title: "Loose idea", content: "[]", folderId: nil, markdown: "Loose idea")
        mirror.rootURL = out
        mirror.sync()

        XCTAssertEqual(files(), ["Home projects", "Home projects/Paint colors.md", "Loose idea.md"])
        XCTAssertEqual(read("Home projects/Paint colors.md"), "# Paint colors\n")
    }

    func testSameTitlesGetNumbered() {
        _ = store.save(id: "a", title: "Idea", content: "[]", folderId: nil, markdown: "one")
        _ = store.save(id: "b", title: "idea", content: "[]", folderId: nil, markdown: "two")
        mirror.rootURL = out
        mirror.sync()
        // The Mac's disk ignores case, so "idea" clashes with "Idea" too.
        XCTAssertEqual(files(), ["Idea.md", "idea 2.md"])
    }

    func testSkipsNotesWithoutMarkdownYet() {
        _ = store.save(id: "a", title: "Old", content: "[1]", folderId: nil, markdown: nil)
        mirror.rootURL = out
        mirror.sync()
        XCTAssertEqual(files(), [])
    }

    func testFollowsRenamesMovesAndDeletes() {
        _ = store.saveFolders([["id": "f1", "name": "Home"]])
        _ = store.save(id: "a", title: "Paint", content: "[]", folderId: "f1", markdown: "Paint")
        _ = store.save(id: "b", title: "Other", content: "[]", folderId: nil, markdown: "Other")
        mirror.rootURL = out
        mirror.sync()

        _ = store.save(id: "a", title: "Paint plan", content: "[]", folderId: nil, markdown: "Paint plan")
        mirror.sync()
        XCTAssertEqual(files(), ["Home", "Home/Paint plan.md", "Other.md"])

        _ = store.saveFolders([["id": "f1", "name": "House"]])
        mirror.sync()
        XCTAssertEqual(files(), ["House", "House/Paint plan.md", "Other.md"])

        _ = store.move(id: "a", folderId: nil)
        mirror.sync()
        XCTAssertEqual(files(), ["Other.md", "Paint plan.md"], "an emptied folder is removed")

        _ = store.delete("b")
        mirror.sync()
        XCTAssertEqual(files(), ["Paint plan.md"])
    }

    func testNeverDeletesFilesItDidNotWrite() throws {
        _ = store.save(id: "a", title: "A", content: "[]", folderId: nil, markdown: "A")
        mirror.rootURL = out
        mirror.sync()
        try "mine".write(to: out.appendingPathComponent("my file.txt"), atomically: true, encoding: .utf8)

        _ = store.delete("a")
        mirror.sync()
        XCTAssertEqual(files(), ["my file.txt"])
    }

    func testTurningItOffLeavesFilesAlone() {
        _ = store.save(id: "a", title: "A", content: "[]", folderId: nil, markdown: "A")
        mirror.rootURL = out
        mirror.sync()

        mirror.rootURL = nil
        _ = store.delete("a")
        mirror.sync()
        XCTAssertEqual(files(), ["A.md"])
    }

    func testSafeName() {
        XCTAssertEqual(MarkdownMirror.safeName("a/b: c"), "a-b- c")
        XCTAssertEqual(MarkdownMirror.safeName("  spaced  "), "spaced")
        XCTAssertEqual(MarkdownMirror.safeName("..hidden"), "hidden")
        XCTAssertEqual(MarkdownMirror.safeName(""), "Untitled")
        XCTAssertEqual(MarkdownMirror.safeName("line\nbreak"), "line-break")
        XCTAssertEqual(MarkdownMirror.safeName(String(repeating: "x", count: 150)).count, 100)
    }
}
