import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var model: AppModel!
    private var menu: StatusMenu!
    private var libraryWindow: NSWindow?
    private var pendingOpens: [URL] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        model = AppModel()
        menu = StatusMenu(model: model) { [weak self] in self?.openLibrary() }
        // Every web view gets the network block, so build it before the first one exists.
        Task { @MainActor in
            await NetworkLock.prepare()
            self.model.start()
            if !self.pendingOpens.isEmpty { self.openLibrary() }
            self.pendingOpens.forEach { self.model.review($0) }
            self.pendingOpens = []
        }
        NSApp.mainMenu = MainMenu.make(target: self)
        // Quiet at login: the window only opens by itself the very first time.
        if model.isFirstRun { openLibrary() }
    }

    /// Double-clicked .tokonoma files (or `open -a Tokonoma x.tokonoma` from the MCP server).
    func application(_ application: NSApplication, open urls: [URL]) {
        let packages = urls.filter { $0.pathExtension.lowercased() == "tokonoma" }
        guard !packages.isEmpty else { return }
        // Opening a file can launch the app, before the model or network block exist.
        guard model != nil, NetworkLock.isReady else {
            pendingOpens += packages
            return
        }
        openLibrary()
        packages.forEach { model.review($0) }
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

    /// A closed library keeps nothing running: its live preview and views go with it.
    func windowWillClose(_ notification: Notification) {
        guard (notification.object as? NSWindow) === libraryWindow else { return }
        libraryWindow?.contentView = nil
        libraryWindow = nil
    }

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
            window.appearance = NSAppearance(named: .darkAqua)
            window.backgroundColor = NSColor(Ink.page)
            window.titlebarAppearsTransparent = true
            window.titleVisibility = .hidden
            window.isReleasedWhenClosed = false
            window.minSize = NSSize(width: 820, height: 540)
            window.contentView = NSHostingView(rootView: LibraryView().environmentObject(model))
            window.center()
            window.setFrameAutosaveName("TokonomaLibrary")
            window.delegate = self
            libraryWindow = window
        }
        NSApp.activate(ignoringOtherApps: true)
        libraryWindow?.makeKeyAndOrderFront(nil)
    }
}
