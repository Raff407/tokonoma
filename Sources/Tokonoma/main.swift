import AppKit

if MainActor.assumeIsolated({ InspectCommand.requested }) {
    MainActor.assumeIsolated { InspectCommand.run() }
} else {
    let app = NSApplication.shared
    let delegate = MainActor.assumeIsolated { AppDelegate() }
    app.delegate = delegate
    app.run()
}
