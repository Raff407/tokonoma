import CoreServices
import Darwin
import Foundation

/// Why the app is starting. Someone opening it (Finder, Dock, Spotlight, `open`)
/// expects a window; macOS starting it at login should leave no trace but the wallpaper.
public enum LaunchIntent {
    // Not exposed to Swift: 'lgit' and 'svit' from AERegistry.h.
    static let loginItem: OSType = 0x6C67_6974
    static let serviceItem: OSType = 0x7376_6974
    /// macOS doesn't always mark a login launch, so anything this soon after logging in counts as one.
    static let loginGrace: TimeInterval = 60

    /// Pass NSAppleEventManager's current event during launch. No event means
    /// launchd or a shell started it, which nobody clicked on either.
    public static func openedByHand(_ event: NSAppleEventDescriptor?, now: Date = Date(), login: Date? = consoleLogin()) -> Bool {
        guard let event, event.eventClass == AEEventClass(kCoreEventClass),
              event.eventID == AEEventID(kAEOpenApplication)
        else { return false }
        let reason = event.paramDescriptor(forKeyword: AEKeyword(keyAEPropData))?.enumCodeValue
        guard reason != loginItem, reason != serviceItem else { return false }
        if let login, now.timeIntervalSince(login) < loginGrace { return false }
        return true
    }

    /// When this user last logged in at the Mac's own screen.
    public static func consoleLogin() -> Date? {
        setutxent()
        defer { endutxent() }
        var latest: Date?
        while let entry = getutxent()?.pointee {
            let line = withUnsafeBytes(of: entry.ut_line) { String(decoding: $0.prefix { $0 != 0 }, as: UTF8.self) }
            guard entry.ut_type == USER_PROCESS, line == "console" else { continue }
            let at = Date(timeIntervalSince1970: TimeInterval(entry.ut_tv.tv_sec))
            latest = max(latest ?? at, at)
        }
        return latest
    }
}
