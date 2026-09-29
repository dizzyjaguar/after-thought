import AppKit
import Carbon
import ServiceManagement

final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private let store = NoteStore()
    private lazy var mirror = MarkdownMirror(store: store)
    private var mirrorToggle: NSMenuItem!
    private var mirrorShow: NSMenuItem!
    private var mirrorChange: NSMenuItem!
    private let hotKeys = HotKeys()
    private var editor: EditorWebView!
    private var panel: Panel!
    private var statusItem: NSStatusItem!

    func applicationDidFinishLaunching(_ notification: Notification) {
        editor = EditorWebView(store: store)
        panel = Panel(content: editor.webView)
        editor.onHide = { [weak self] in self?.hide() }
        panel.onToggleSidebar = { [weak self] in self?.editor.command("toggleSidebar") }

        // ⌘⇧Space: toggle, reopening the last note. ⌃⌥N: new note.
        hotKeys.register(keyCode: kVK_Space, modifiers: cmdKey | shiftKey) { [weak self] in self?.toggleLast() }
        hotKeys.register(keyCode: kVK_ANSI_N, modifiers: controlKey | optionKey) { [weak self] in self?.show("new") }

        setUpStatusItem()
        EditorWebView.cleanUpCopiedFiles()

        store.onChange = { [weak self] in self?.mirror.scheduleSync() }
        mirror.sync()
    }

    private func show(_ command: String) {
        // Actually activate: WebKit drops hover state (tooltips, hover menus) in
        // windows of an inactive app, even when the panel is key.
        NSApp.activate(ignoringOtherApps: true)
        panel.present()
        panel.makeFirstResponder(editor.webView)
        editor.command(command)
    }

    /// The panel stays open when you click away; only esc or this hotkey closes it.
    private func toggleLast() {
        if panel.isVisible { hide() } else { show("last") }
    }

    private func hide() {
        guard panel.isVisible else { return }
        panel.orderOut(nil)
        // Hand focus back to whatever app was in front before.
        NSApp.hide(nil)
    }

    // MARK: Menu bar

    private func setUpStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = NSImage(systemSymbolName: "sparkle", accessibilityDescription: "After Thought")
        statusItem.button?.toolTip = "After Thought"

        let menu = NSMenu()
        menu.addItem(item("Open Last Note", "⌘⇧Space", #selector(menuLast)))
        menu.addItem(item("New Note", "⌃⌥N", #selector(menuNew)))
        menu.addItem(.separator())
        menu.addItem(item("Show Notes Folder", nil, #selector(openFolder)))

        let mirrorMenu = NSMenu()
        mirrorToggle = item("Keep a Markdown Copy…", nil, #selector(toggleMirror))
        mirrorShow = item("Show in Finder", nil, #selector(showMirror))
        mirrorChange = item("Change Folder…", nil, #selector(changeMirror))
        [mirrorToggle, mirrorShow, mirrorChange].forEach { mirrorMenu.addItem($0) }
        let mirrorItem = NSMenuItem(title: "Markdown Copy", action: nil, keyEquivalent: "")
        mirrorItem.submenu = mirrorMenu
        menu.addItem(mirrorItem)

        let login = item("Launch at Login", nil, #selector(toggleLogin))
        login.state = SMAppService.mainApp.status == .enabled ? .on : .off
        menu.addItem(login)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit after-thought", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        menu.delegate = self
        menu.autoenablesItems = false
        mirrorMenu.autoenablesItems = false
        statusItem.menu = menu
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        let on = mirror.rootURL != nil
        mirrorToggle.state = on ? .on : .off
        mirrorShow.isEnabled = on
        mirrorChange.isEnabled = on
    }

    private func item(_ title: String, _ hint: String?, _ action: Selector) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
        item.target = self
        if let hint { item.toolTip = hint; item.title = "\(title)    \(hint)" }
        return item
    }

    @objc private func menuLast() { show("last") }
    @objc private func menuNew() { show("new") }
    @objc private func openFolder() { NSWorkspace.shared.open(store.dir) }

    /// Off → pick a folder and start. On → stop (the files already written stay put).
    @objc private func toggleMirror() {
        if mirror.rootURL == nil { mirror.chooseFolder() } else { mirror.rootURL = nil }
    }

    @objc private func showMirror() {
        if let root = mirror.rootURL { NSWorkspace.shared.open(root) }
    }

    @objc private func changeMirror() { mirror.chooseFolder() }

    @objc private func toggleLogin(_ sender: NSMenuItem) {
        do {
            if SMAppService.mainApp.status == .enabled {
                try SMAppService.mainApp.unregister()
            } else {
                try SMAppService.mainApp.register()
            }
        } catch {
            NSLog("after-thought: launch at login failed: \(error)")
        }
        sender.state = SMAppService.mainApp.status == .enabled ? .on : .off
    }
}
