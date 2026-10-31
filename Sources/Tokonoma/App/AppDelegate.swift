import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var model: AppModel!
    private var menu: StatusMenu!
    private var libraryWindow: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        model = AppModel()
        model.start()
        menu = StatusMenu(model: model) { [weak self] in self?.openLibrary() }
        NSApp.mainMenu = MainMenu.make(target: self)
        // Quiet at login: the window only opens by itself the very first time.
        if model.isFirstRun { openLibrary() }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        openLibrary()
        return false
    }

    /// Right-click on the Dock icon.
    func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
        let dock = NSMenu()
        dock.addItem(withTitle: model.settings.userPaused ? "Resume" : "Pause", action: #selector(togglePause), keyEquivalent: "").target = self
        dock.addItem(withTitle: "Next Wallpaper", action: #selector(nextWallpaper), keyEquivalent: "").target = self
        return dock
    }

    @objc func togglePause() { model.togglePause() }
    @objc func nextWallpaper() { model.showNext() }
    @objc func showLibrary() { openLibrary() }

    func applicationWillTerminate(_ notification: Notification) {
        model.stop()
    }

    func openLibrary() {
        if libraryWindow == nil {
            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 1080, height: 700),
                styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                backing: .buffered,
                defer: false
            )
            window.title = "Tokonoma"
            window.titlebarAppearsTransparent = true
            window.titleVisibility = .hidden
            window.isReleasedWhenClosed = false
            window.minSize = NSSize(width: 820, height: 540)
            window.contentView = NSHostingView(rootView: LibraryView().environmentObject(model))
            window.center()
            window.setFrameAutosaveName("TokonomaLibrary")
            libraryWindow = window
        }
        NSApp.activate(ignoringOtherApps: true)
        libraryWindow?.makeKeyAndOrderFront(nil)
    }
}
