import AppKit

/// The menu bar shown while the library is open: app, edit (so text fields copy and paste),
/// wallpaper controls and window.
@MainActor
enum MainMenu {
    static func make(target: AppDelegate) -> NSMenu {
        let bar = NSMenu()

        let app = submenu(in: bar, "Tokonoma")
        app.addItem(withTitle: "About Tokonoma", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        app.addItem(.separator())
        item(app, "Library", #selector(AppDelegate.showLibrary), "l", target)
        app.addItem(.separator())
        app.addItem(withTitle: "Hide Tokonoma", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        app.addItem(withTitle: "Quit Tokonoma", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let edit = submenu(in: bar, "Edit")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        let wallpaper = submenu(in: bar, "Wallpaper")
        item(wallpaper, "Pause or resume", #selector(AppDelegate.togglePause), "p", target)
        item(wallpaper, "Next wallpaper", #selector(AppDelegate.nextWallpaper), "n", target)

        let window = submenu(in: bar, "Window")
        window.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        window.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        NSApp.windowsMenu = window
        return bar
    }

    private static func submenu(in bar: NSMenu, _ title: String) -> NSMenu {
        let holder = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        let menu = NSMenu(title: title)
        holder.submenu = menu
        bar.addItem(holder)
        return menu
    }

    private static func item(_ menu: NSMenu, _ title: String, _ action: Selector, _ key: String, _ target: AnyObject) {
        menu.addItem(withTitle: title, action: action, keyEquivalent: key).target = target
    }
}
