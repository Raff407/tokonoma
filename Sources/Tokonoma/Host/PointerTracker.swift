import AppKit

/// Follows the cursor anywhere on screen (mouse-move monitors need no
/// accessibility permission) and hands out positions at most ~30 times a second.
@MainActor
final class PointerTracker {
    var onMove: ((NSPoint) -> Void)?
    private var monitors: [Any] = []
    private var lastSent = Date.distantPast
    private let interval: TimeInterval = 1.0 / 30

    func start() {
        guard monitors.isEmpty else { return }
        let mask: NSEvent.EventTypeMask = [.mouseMoved, .leftMouseDragged]
        if let global = NSEvent.addGlobalMonitorForEvents(matching: mask, handler: { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }) {
            monitors.append(global)
        }
        if let local = NSEvent.addLocalMonitorForEvents(matching: mask, handler: { [weak self] event in
            MainActor.assumeIsolated { self?.tick() }
            return event
        }) {
            monitors.append(local)
        }
    }

    func stop() {
        monitors.forEach(NSEvent.removeMonitor)
        monitors = []
    }

    private func tick() {
        let now = Date()
        guard now.timeIntervalSince(lastSent) >= interval else { return }
        lastSent = now
        onMove?(NSEvent.mouseLocation)
    }
}
