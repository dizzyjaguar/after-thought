import Carbon
import AppKit

/// System-wide shortcuts via Carbon. Needs no Accessibility permission.
final class HotKeys {
    private var refs: [EventHotKeyRef?] = []
    private var handlers: [UInt32: () -> Void] = [:]
    private var nextId: UInt32 = 1

    init() {
        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        let selfPtr = Unmanaged.passUnretained(self).toOpaque()
        InstallEventHandler(GetApplicationEventTarget(), { _, event, userData in
            guard let event, let userData else { return noErr }
            var hotKeyId = EventHotKeyID()
            GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID),
                              nil, MemoryLayout<EventHotKeyID>.size, nil, &hotKeyId)
            let me = Unmanaged<HotKeys>.fromOpaque(userData).takeUnretainedValue()
            DispatchQueue.main.async { me.handlers[hotKeyId.id]?() }
            return noErr
        }, 1, &spec, selfPtr, nil)
    }

    /// keyCode is a virtual key code (kVK_*), modifiers are Carbon flags (cmdKey, optionKey, …).
    func register(keyCode: Int, modifiers: Int, handler: @escaping () -> Void) {
        let id = nextId
        nextId += 1
        handlers[id] = handler
        var ref: EventHotKeyRef?
        let hotKeyId = EventHotKeyID(signature: OSType(0x4154_484B), id: id) // 'ATHK'
        let status = RegisterEventHotKey(UInt32(keyCode), UInt32(modifiers), hotKeyId,
                                         GetApplicationEventTarget(), 0, &ref)
        if status != noErr { NSLog("after-thought: hotkey \(keyCode) failed (\(status)), maybe taken") }
        refs.append(ref)
    }
}
