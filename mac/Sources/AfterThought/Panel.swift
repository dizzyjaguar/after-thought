import AppKit

/// Floating, borderless panel with a Liquid Glass background.
final class Panel: NSPanel {
    var onToggleSidebar: (() -> Void)?

    init(content: NSView) {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 720, height: 520),
            // Not .nonactivatingPanel: clicking back into the panel should activate the
            // app, or WebKit drops hover state (tooltips) like it did before.
            styleMask: [.borderless, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        isFloatingPanel = true
        level = .floating
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
        hidesOnDeactivate = false
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        isReleasedWhenClosed = false
        acceptsMouseMovedEvents = true
        minSize = NSSize(width: 420, height: 280)
        contentView = Self.glass(around: Self.withDragStrip(content))
        setFrameAutosaveName("AfterThoughtPanel")
    }

    /// Height of the web header bar (`.bar` in styles.css). Keep them in sync.
    static let headerHeight: CGFloat = 40
    /// Left part of the header left uncovered, for the web sidebar toggle (`.bar-toggle`).
    static let toggleInset: CGFloat = 44

    /// Lays an invisible strip over the web header so it drags the window;
    /// the web view would otherwise swallow the clicks.
    private static func withDragStrip(_ content: NSView) -> NSView {
        let container = NSView()
        let strip = DragStrip()
        for view in [content, strip] {
            view.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview(view)
        }
        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: container.topAnchor),
            content.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            content.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            strip.topAnchor.constraint(equalTo: container.topAnchor),
            strip.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: toggleInset),
            strip.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            strip.heightAnchor.constraint(equalToConstant: headerHeight),
        ])
        return container
    }

    private static func glass(around content: NSView) -> NSView {
        let radius: CGFloat = 22
        if #available(macOS 26.0, *) {
            let glass = NSGlassEffectView()
            glass.cornerRadius = radius
            glass.style = .regular
            glass.contentView = content
            return glass
        }
        // Pre-Tahoe fallback: classic vibrancy blur.
        let blur = NSVisualEffectView()
        blur.material = .hudWindow
        blur.blendingMode = .behindWindow
        blur.state = .active
        blur.wantsLayer = true
        blur.layer?.cornerRadius = radius
        blur.layer?.masksToBounds = true
        content.frame = blur.bounds
        content.autoresizingMask = [.width, .height]
        blur.addSubview(content)
        return blur
    }

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }

    /// We have no Edit menu (menu bar app), so wire up the standard shortcuts here.
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        guard event.type == .keyDown,
              event.modifierFlags.intersection(.deviceIndependentFlagsMask).contains(.command),
              let key = event.charactersIgnoringModifiers?.lowercased() else {
            return super.performKeyEquivalent(with: event)
        }
        // ⌘\ toggles the sidebar. Matched by physical key (kVK_ANSI_Backslash)
        // so it works on any keyboard layout.
        if event.keyCode == 42,
           event.modifierFlags.intersection(.deviceIndependentFlagsMask) == .command {
            onToggleSidebar?()
            return true
        }
        // ⌘Z / ⌘⇧Z are left alone on purpose: the editor has its own undo history
        // and needs the key event. Sending undo: would hit WebKit's history instead.
        let action: Selector?
        switch key {
        case "x": action = #selector(NSText.cut(_:))
        case "c": action = #selector(NSText.copy(_:))
        case "v": action = #selector(NSText.paste(_:))
        case "a": action = #selector(NSText.selectAll(_:))
        default: action = nil
        }
        if let action, NSApp.sendAction(action, to: nil, from: self) { return true }
        return super.performKeyEquivalent(with: event)
    }

    /// Shows the panel where you last left it. Centers it on the mouse's screen
    /// the first time, or when that screen doesn't contain the saved spot.
    func present() {
        let mouse = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { $0.frame.contains(mouse) } ?? NSScreen.main
        let hasSavedFrame = UserDefaults.standard.string(forKey: "NSWindow Frame AfterThoughtPanel") != nil
        if let visible = screen?.visibleFrame, !hasSavedFrame || !visible.intersects(frame) {
            let size = frame.size
            setFrameOrigin(NSPoint(x: visible.midX - size.width / 2,
                                   y: visible.midY - size.height / 2 + visible.height * 0.08))
            saveFrame(usingName: "AfterThoughtPanel")
        }
        makeKeyAndOrderFront(nil)
    }
}

/// Transparent view that moves its window when dragged.
private final class DragStrip: NSView {
    override var mouseDownCanMoveWindow: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func mouseDown(with event: NSEvent) {
        window?.performDrag(with: event)
    }
}
