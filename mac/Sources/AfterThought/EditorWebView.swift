import AppKit
import WebKit
import UniformTypeIdentifiers

/// Hosts the BlockNote editor and answers its bridge calls.
final class EditorWebView: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate {
    let webView: WKWebView
    private let store: NoteStore
    var onHide: (() -> Void)?
    private var loaded = false
    private var queued: [String] = []

    init(store: NoteStore) {
        self.store = store
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: "afterthought")
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()

        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "bridge")
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground") // let the glass show through
        webView.autoresizingMask = [.width, .height]
        #if DEBUG
        if #available(macOS 13.3, *) { webView.isInspectable = true }
        #endif

        // `AFTER_THOUGHT_DEV_URL=http://localhost:5173` loads the Vite dev server instead.
        let dev = ProcessInfo.processInfo.environment["AFTER_THOUGHT_DEV_URL"]
        let url = URL(string: dev ?? "afterthought://app/index.html")!
        webView.load(URLRequest(url: url))
    }

    /// Runs a command in the editor ("new" or "last"), waiting for load if needed.
    func command(_ name: String) {
        let js = "window.afterThought && window.afterThought.command('\(name)')"
        if loaded { webView.evaluateJavaScript(js) } else { queued.append(js) }
    }

    private static var clipboardDir: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("after-thought-clipboard", isDirectory: true)
    }

    /// Deletes copied files older than a day. By then they've been pasted (Claude keeps
    /// its own copy of an attachment) or forgotten.
    static func cleanUpCopiedFiles() {
        let fm = FileManager.default
        let cutoff = Date().addingTimeInterval(-24 * 60 * 60)
        let dirs = (try? fm.contentsOfDirectory(at: clipboardDir, includingPropertiesForKeys: [.creationDateKey])) ?? []
        for dir in dirs {
            let created = (try? dir.resourceValues(forKeys: [.creationDateKey]))?.creationDate ?? .distantPast
            if created < cutoff { try? fm.removeItem(at: dir) }
        }
    }

    /// Writes `text` to a temp file and puts the file on the clipboard, like copying it in
    /// Finder. Apps that take attachments paste it as a file. Each copy gets its own
    /// folder so the file keeps its readable name.
    private static func copyFile(name: String, text: String) -> Bool {
        // No path separators or control characters in the file name.
        let banned = CharacterSet(charactersIn: "/:\\").union(.newlines).union(.controlCharacters)
        var safe = String(String.UnicodeScalarView(name.unicodeScalars.map { banned.contains($0) ? "-" : $0 }))
            .trimmingCharacters(in: .whitespaces)
        if safe.hasPrefix(".") || safe.isEmpty { safe = "Note" + safe }
        if safe.count > 100 { safe = String(safe.prefix(97)) + ".md" }

        let dir = clipboardDir.appendingPathComponent(UUID().uuidString, isDirectory: true)
        let file = dir.appendingPathComponent(safe)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try text.write(to: file, atomically: true, encoding: .utf8)
        } catch {
            NSLog("after-thought: copyFile failed: \(error)")
            return false
        }
        NSPasteboard.general.clearContents()
        return NSPasteboard.general.writeObjects([file as NSURL])
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded = true
        // Give React a tick to register window.afterThought.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            guard let self else { return }
            self.queued.forEach { self.webView.evaluateJavaScript($0) }
            self.queued.removeAll()
        }
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else {
            return replyHandler(nil, "bad message")
        }
        let id = body["id"] as? String ?? ""
        switch type {
        case "list": replyHandler(store.list(), nil)
        case "load": replyHandler(store.load(id) ?? NSNull(), nil)
        case "save":
            replyHandler(store.save(id: id, title: body["title"] as? String ?? "",
                                    content: body["content"] as? String ?? "",
                                    folderId: body["folderId"] as? String,
                                    markdown: body["markdown"] as? String), nil)
        case "idsMissingMarkdown": replyHandler(store.idsMissingMarkdown(), nil)
        case "setMarkdown":
            replyHandler(store.setMarkdown(id: id, markdown: body["markdown"] as? String ?? ""), nil)
        case "move": replyHandler(store.move(id: id, folderId: body["folderId"] as? String), nil)
        case "folders": replyHandler(store.folders(), nil)
        case "saveFolders": replyHandler(store.saveFolders(body["folders"] as? [[String: Any]] ?? []), nil)
        case "deleteFolder": replyHandler(store.deleteFolder(id), nil)
        case "delete": replyHandler(store.delete(id), nil)
        case "getLastId": replyHandler(store.lastId ?? NSNull(), nil)
        case "setLastId": store.lastId = id; replyHandler(true, nil)
        case "hide": onHide?(); replyHandler(true, nil)
        case "copy":
            NSPasteboard.general.clearContents()
            replyHandler(NSPasteboard.general.setString(body["text"] as? String ?? "", forType: .string), nil)
        case "copyFile":
            replyHandler(Self.copyFile(name: body["name"] as? String ?? "Note.md",
                                       text: body["text"] as? String ?? ""), nil)
        default: replyHandler(nil, "unknown type \(type)")
        }
    }
}

/// Serves the built web app from the bundle's Resources/web folder.
private final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root = Bundle.main.resourceURL!.appendingPathComponent("web").standardizedFileURL

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let path = task.request.url?.path ?? "/index.html"
        let file = root.appendingPathComponent(path).standardizedFileURL
        guard file.path.hasPrefix(root.path), let data = try? Data(contentsOf: file) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let response = HTTPURLResponse(url: task.request.url!, statusCode: 200, httpVersion: "HTTP/1.1",
                                       headerFields: ["Content-Type": mime, "Content-Length": "\(data.count)"])!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
