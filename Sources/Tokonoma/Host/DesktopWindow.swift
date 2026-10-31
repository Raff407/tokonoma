import AppKit

/// A borderless window pinned to the desktop layer of one screen: under the
/// icons, on every Space, never focusable, clicks pass straight through.
final class DesktopWindow: NSWindow {
    let displayID: String

    init(screen: NSScreen, displayID: String, content: NSView) {
        self.displayID = displayID
        super.init(contentRect: screen.frame, styleMask: [.borderless], backing: .buffered, defer: false)
        level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))
        collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenNone]
        ignoresMouseEvents = true
        isOpaque = true
        hasShadow = false
        backgroundColor = .black
        isReleasedWhenClosed = false
        animationBehavior = .none
        contentView = content
        place(on: screen)
    }

    func place(on screen: NSScreen) {
        setFrame(screen.frame, display: true)
    }

    var isCovered: Bool { !occlusionState.contains(.visible) }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

extension NSScreen {
    /// Stable across reboots and reconnects, unlike the CGDirectDisplayID.
    var tokonomaID: String {
        guard let number = deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else {
            return "main"
        }
        let id = CGDirectDisplayID(number.uint32Value)
        guard let uuid = CGDisplayCreateUUIDFromDisplayID(id)?.takeRetainedValue() else { return "display-\(id)" }
        return CFUUIDCreateString(nil, uuid) as String
    }
}
