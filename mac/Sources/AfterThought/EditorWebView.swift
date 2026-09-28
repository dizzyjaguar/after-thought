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
                                    folderId: body["folderId"] as? String), nil)
        case "move": replyHandler(store.move(id: id, folderId: body["folderId"] as? String), nil)
        case "folders": replyHandler(store.folders(), nil)
        case "saveFolders": replyHandler(store.saveFolders(body["folders"] as? [[String: Any]] ?? []), nil)
        case "deleteFolder": replyHandler(store.deleteFolder(id), nil)
        case "delete": replyHandler(store.delete(id), nil)
        case "getLastId": replyHandler(store.lastId ?? NSNull(), nil)
        case "setLastId": store.lastId = id; replyHandler(true, nil)
        case "hide": onHide?(); replyHandler(true, nil)
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
