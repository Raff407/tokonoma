import AppKit
import TokonomaCore

/// Keeps one DesktopWindow + WallpaperHost per connected screen, and tells the
/// owner whenever screens come and go or a window's visibility changes.
@MainActor
final class DesktopController {
    struct Desk {
        let window: DesktopWindow
        let host: WallpaperHost
        var name: String
    }

    private(set) var desks: [String: Desk] = [:]
    var onChange: (() -> Void)?
    var onError: ((String) -> Void)?
    private var observers: [NSObjectProtocol] = []

    init() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.syncScreens() }
        })
    }

    func syncScreens() {
        let screens = NSScreen.screens
        let live = Set(screens.map(\.tokonomaID))
        for (id, desk) in desks where !live.contains(id) {
            desk.window.orderOut(nil)
            desk.window.close()
            desks[id] = nil
        }
        for screen in screens {
            let id = screen.tokonomaID
            if var desk = desks[id] {
                desk.window.place(on: screen)
                desk.name = screen.localizedName
                desks[id] = desk
            } else {
                desks[id] = makeDesk(screen: screen, id: id)
            }
        }
        onChange?()
    }

    private func makeDesk(screen: NSScreen, id: String) -> Desk {
        let host = WallpaperHost()
        host.onError = { [weak self] message in self?.onError?(message) }
        let window = DesktopWindow(screen: screen, displayID: id, content: host.webView)
        NotificationCenter.default.addObserver(forName: NSWindow.didChangeOcclusionStateNotification, object: window, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.onChange?() }
        }
        window.orderFrontRegardless()
        return Desk(window: window, host: host, name: screen.localizedName)
    }

    /// Which display the cursor is over, and where on it from 0 to 1 (top-left origin).
    func locate(_ point: NSPoint) -> (id: String, x: Double, y: Double)? {
        for (id, desk) in desks {
            let f = desk.window.frame
            if f.contains(point) {
                return (id, (point.x - f.minX) / f.width, 1 - (point.y - f.minY) / f.height)
            }
        }
        return nil
    }

    func tearDown() {
        for desk in desks.values { desk.window.close() }
        desks = [:]
    }
}
