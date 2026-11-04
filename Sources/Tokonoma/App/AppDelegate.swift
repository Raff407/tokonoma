import AppKit
import SwiftUI
import TokonomaCore

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var model: AppModel!
    private var menu: StatusMenu!
    private var libraryWindow: NSWindow?
    private var pendingOpens: [URL] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        // LSUIElement keeps the app out of the Dock and Cmd-Tab until the library opens.
        let openedByHand = LaunchIntent.openedByHand(NSAppleEventManager.shared().currentAppleEvent)
        model = AppModel()
        menu = StatusMenu(model: model) { [weak self] in self?.openLibrary() }
        // Every web view gets the network block, so build it before the first one exists.
        Task { @MainActor in
            await NetworkLock.prepare()
            self.model.start()
            // Quiet at login: only someone opening the app, or the first run, gets a window.
            if openedByHand || self.model.isFirstRun || !self.pendingOpens.isEmpty { self.openLibrary() }
            self.take(self.pendingOpens)
            self.pendingOpens = []
        }
        NSApp.mainMenu = MainMenu.make(target: self)
    }

    /// Double-clicked .tokonoma files (or `open -a Tokonoma x.tokonoma` from the MCP server),
    /// and clips or pictures dropped on the Dock icon.
    func application(_ application: NSApplication, open urls: [URL]) {
        let wanted = urls.filter { $0.pathExtension.lowercased() == "tokonoma" || MediaImporter.kind(of: $0) != nil }
        guard !wanted.isEmpty else { return }
        // Opening a file can launch the app, before the model or network block exist.
        guard model != nil, NetworkLock.isReady else {
            pendingOpens += wanted
            return
        }
        openLibrary()
        take(wanted)
    }

    /// importFiles sends packages to review and imports the rest.
    private func take(_ urls: [URL]) {
        guard !urls.isEmpty else { return }
        Task { await model.importFiles(urls) }
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
        // Back to wallpaper only: no Dock icon, nothing in Cmd-Tab, focus returns to the last app.
        NSApp.setActivationPolicy(.accessory)
        NSApp.hide(nil)
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
            // A frame saved before the minimum existed can be narrower than the layout allows.
            if window.frame.width < window.minSize.width || window.frame.height < window.minSize.height {
                var frame = window.frame
                frame.size = NSSize(width: max(frame.width, window.minSize.width), height: max(frame.height, window.minSize.height))
                window.setFrame(frame, display: false)
            }
            window.delegate = self
            libraryWindow = window
        }
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        libraryWindow?.makeKeyAndOrderFront(nil)
    }
}
