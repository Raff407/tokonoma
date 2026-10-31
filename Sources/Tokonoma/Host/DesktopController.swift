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
        let occlusion: NSObjectProtocol
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
            NotificationCenter.default.removeObserver(desk.occlusion)
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
        let occlusion = NotificationCenter.default.addObserver(forName: NSWindow.didChangeOcclusionStateNotification, object: window, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.onChange?() }
        }
        window.orderFrontRegardless()
        return Desk(window: window, host: host, name: screen.localizedName, occlusion: occlusion)
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

    /// Left to right, with identical monitors told apart as "DELL U2723QE (2)".
    var displays: [DisplayInfo] {
        let ordered = desks.sorted { ($0.value.window.frame.minX, $0.key) < ($1.value.window.frame.minX, $1.key) }
        var seen: [String: Int] = [:]
        let total = Dictionary(grouping: ordered, by: { $0.value.name }).mapValues(\.count)
        return ordered.map { id, desk in
            seen[desk.name, default: 0] += 1
            let name = (total[desk.name] ?? 0) > 1 ? "\(desk.name) (\(seen[desk.name]!))" : desk.name
            return DisplayInfo(id: id, name: name)
        }
    }

    func tearDown() {
        for desk in desks.values {
            NotificationCenter.default.removeObserver(desk.occlusion)
            desk.window.close()
        }
        desks = [:]
    }
}
