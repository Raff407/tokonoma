import AppKit

/// Was a click on bare desktop, or on a window, the Dock or the menu bar?
/// Clicks pass through the wallpaper to Finder, so the only way to know is to
/// ask the window server what else sits under that point.
enum DesktopHitTest {
    static func isBareDesktop(_ point: NSPoint) -> Bool {
        // AppKit points start bottom-left of the main screen; window bounds start top-left.
        guard let main = NSScreen.screens.first else { return false }
        let probe = CGPoint(x: point.x, y: main.frame.maxY - point.y)
        let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
            as? [[String: Any]] ?? []
        for window in windows {
            guard let bounds = window[kCGWindowBounds as String] as? NSDictionary,
                  let rect = CGRect(dictionaryRepresentation: bounds) else { continue }
            let alpha = window[kCGWindowAlpha as String] as? Double ?? 1
            if alpha > 0.01 && rect.contains(probe) { return false }
        }
        return true
    }
}
