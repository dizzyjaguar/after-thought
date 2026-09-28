import AppKit
import Carbon
import ServiceManagement

final class AppDelegate: NSObject, NSApplicationDelegate {
    private let store = NoteStore()
    private let hotKeys = HotKeys()
    private var editor: EditorWebView!
    private var panel: Panel!
    private var statusItem: NSStatusItem!

    func applicationDidFinishLaunching(_ notification: Notification) {
        editor = EditorWebView(store: store)
        panel = Panel(content: editor.webView)
        panel.onResignKey = { [weak self] in self?.hide() }
        editor.onHide = { [weak self] in self?.hide() }

        // ⌘⇧Space: toggle, reopening the last note. ⌃⌥N: new note.
        hotKeys.register(keyCode: kVK_Space, modifiers: cmdKey | shiftKey) { [weak self] in self?.toggleLast() }
        hotKeys.register(keyCode: kVK_ANSI_N, modifiers: controlKey | optionKey) { [weak self] in self?.show("new") }

        setUpStatusItem()
    }

    private func show(_ command: String) {
        // Actually activate: WebKit drops hover state (tooltips, hover menus) in
        // windows of an inactive app, even when the panel is key.
        NSApp.activate(ignoringOtherApps: true)
        panel.present()
        panel.makeFirstResponder(editor.webView)
        editor.command(command)
    }

    private func toggleLast() {
        if panel.isVisible && panel.isKeyWindow { hide() } else { show("last") }
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
        statusItem.button?.image = NSImage(systemSymbolName: "note.text", accessibilityDescription: "after-thought")

        let menu = NSMenu()
        menu.addItem(item("Open Last Note", "⌘⇧Space", #selector(menuLast)))
        menu.addItem(item("New Note", "⌃⌥N", #selector(menuNew)))
        menu.addItem(.separator())
        menu.addItem(item("Show Notes Folder", nil, #selector(openFolder)))
        let login = item("Launch at Login", nil, #selector(toggleLogin))
        login.state = SMAppService.mainApp.status == .enabled ? .on : .off
        menu.addItem(login)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit after-thought", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        statusItem.menu = menu
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
