import AppKit

/// Follows the cursor anywhere on screen and hears clicks (mouse monitors need
/// no accessibility permission); positions go out at most ~30 times a second.
@MainActor
final class PointerTracker {
    var onMove: ((NSPoint) -> Void)?
    var onClick: ((NSPoint) -> Void)?
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
        // Clicks on the wallpaper land in Finder, another app, so only the global monitor sees them.
        if let clicks = NSEvent.addGlobalMonitorForEvents(matching: .leftMouseDown, handler: { [weak self] _ in
            MainActor.assumeIsolated { self?.onClick?(NSEvent.mouseLocation) }
        }) {
            monitors.append(clicks)
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
