import AppKit
import TokonomaCore

/// The menu-bar torii. Rebuilt each time it opens, so it never goes stale.
@MainActor
final class StatusMenu: NSObject, NSMenuDelegate {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    private let model: AppModel
    private let openLibrary: () -> Void

    init(model: AppModel, openLibrary: @escaping () -> Void) {
        self.model = model
        self.openLibrary = openLibrary
        super.init()
        item.button?.image = ToriiIcon.make(size: 18)
        item.button?.toolTip = "Tokonoma"
        let menu = NSMenu()
        menu.delegate = self
        item.menu = menu
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()

        let status = NSMenuItem(title: model.summary, action: nil, keyEquivalent: "")
        status.isEnabled = false
        menu.addItem(status)
        menu.addItem(.separator())

        addScenes(to: menu)
        menu.addItem(.separator())

        menu.addItem(action(model.settings.userPaused ? "Resume" : "Pause", #selector(togglePause), key: "p"))
        menu.addItem(action("Next Wallpaper", #selector(next), key: "n"))
        menu.addItem(action("Open Library…", #selector(library), key: "l"))
        menu.addItem(.separator())

        let login = action("Open at Login", #selector(toggleLogin))
        login.state = LaunchAtLogin.isEnabled ? .on : .off
        menu.addItem(login)
        menu.addItem(action("Quit Tokonoma", #selector(quit), key: "q"))
    }

    /// Only your favourites, plus whatever is hanging now, so the menu stays short
    /// however big the library grows. Everything else is one click away in the library.
    private func addScenes(to menu: NSMenu) {
        let listed = model.wallpapers.filter { model.settings.isFavourite($0.id) || model.isShownAnywhere($0.id) }
        for wallpaper in listed {
            let entry = action(label(for: wallpaper), #selector(pick(_:)))
            entry.representedObject = wallpaper.id
            entry.state = model.settings.fallbackWallpaper == wallpaper.id && model.settings.assignments.isEmpty ? .on : .off
            if model.settings.assignments.values.contains(wallpaper.id) { entry.state = .mixed }
            menu.addItem(entry)
        }
        if model.favourites.isEmpty {
            let hint = NSMenuItem(title: "Star scenes in the library to list them here", action: nil, keyEquivalent: "")
            hint.isEnabled = false
            menu.addItem(hint)
        }
    }

    private func label(for wallpaper: Wallpaper) -> String {
        guard let title = wallpaper.manifest.title else { return wallpaper.name }
        return "\(wallpaper.name)  \(title)"
    }

    private func action(_ title: String, _ selector: Selector, key: String = "") -> NSMenuItem {
        let entry = NSMenuItem(title: title, action: selector, keyEquivalent: key)
        entry.target = self
        return entry
    }

    @objc private func pick(_ sender: NSMenuItem) {
        guard let id = sender.representedObject as? String else { return }
        model.show(id)
    }

    @objc private func togglePause() { model.togglePause() }
    @objc private func next() { model.showNext() }
    @objc private func library() { openLibrary() }
    @objc private func quit() { NSApp.terminate(nil) }

    @objc private func toggleLogin() {
        if let problem = LaunchAtLogin.set(!LaunchAtLogin.isEnabled) {
            model.notice = problem
            openLibrary()
        }
    }
}

/// A tiny torii drawn as a template image so it tints with the menu bar.
enum ToriiIcon {
    static func make(size: CGFloat) -> NSImage {
        let image = NSImage(size: NSSize(width: size, height: size), flipped: true) { rect in
            let u = rect.width / 18
            NSColor.black.setFill()
            // Kasagi: the top beam, lifted at both ends.
            let top = NSBezierPath()
            top.move(to: NSPoint(x: 1 * u, y: 3 * u))
            top.curve(to: NSPoint(x: 17 * u, y: 3 * u), controlPoint1: NSPoint(x: 6 * u, y: 5.2 * u), controlPoint2: NSPoint(x: 12 * u, y: 5.2 * u))
            top.line(to: NSPoint(x: 16.4 * u, y: 5.4 * u))
            top.curve(to: NSPoint(x: 1.6 * u, y: 5.4 * u), controlPoint1: NSPoint(x: 12 * u, y: 7 * u), controlPoint2: NSPoint(x: 6 * u, y: 7 * u))
            top.close()
            top.fill()
            // Nuki: the lower crossbeam.
            NSBezierPath(rect: NSRect(x: 2.5 * u, y: 8.2 * u, width: 13 * u, height: 1.6 * u)).fill()
            // Hashira: two pillars, leaning in very slightly.
            for x in [4.6, 12.0] {
                let pillar = NSBezierPath()
                let lean = x < 9 ? 0.25 : -0.25
                pillar.move(to: NSPoint(x: (x + lean) * u, y: 5.5 * u))
                pillar.line(to: NSPoint(x: (x + 1.4 + lean) * u, y: 5.5 * u))
                pillar.line(to: NSPoint(x: (x + 1.5) * u, y: 16.5 * u))
                pillar.line(to: NSPoint(x: (x - 0.1) * u, y: 16.5 * u))
                pillar.close()
                pillar.fill()
            }
            return true
        }
        image.isTemplate = true
        return image
    }
}
