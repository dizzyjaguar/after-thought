import AppKit

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
// Menu bar app: no Dock icon, like Raycast.
app.setActivationPolicy(.accessory)
app.run()
