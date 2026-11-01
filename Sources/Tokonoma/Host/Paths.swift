import Foundation

/// Where things live on disk.
///   ~/Library/Application Support/Tokonoma/
///     Wallpapers/   built-ins (refreshed each launch) + your imports
///     Thumbnails/   cached library stills
///     settings.json
struct Paths {
    let support: URL
    let library: URL
    let thumbnails: URL
    let settings: URL
    let bundledWallpapers: URL
    /// rules.js + validate.js, shared with the MCP server and registry.
    let marketScripts: URL

    static func standard() -> Paths {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Tokonoma", isDirectory: true)
        return Paths(
            support: base,
            library: base.appendingPathComponent("Wallpapers", isDirectory: true),
            thumbnails: base.appendingPathComponent("Thumbnails", isDirectory: true),
            settings: base.appendingPathComponent("settings.json"),
            bundledWallpapers: bundled(),
            marketScripts: market()
        )
    }

    /// Inside the .app it's Resources/Wallpapers; under `swift run` it's the repo folder.
    private static func bundled() -> URL {
        if let inApp = Bundle.main.resourceURL?.appendingPathComponent("Wallpapers"),
           FileManager.default.fileExists(atPath: inApp.path) {
            return inApp
        }
        return URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // Host
            .deletingLastPathComponent() // Tokonoma
            .deletingLastPathComponent() // Sources
            .deletingLastPathComponent() // repo
            .appendingPathComponent("Wallpapers", isDirectory: true)
    }

    private static func market() -> URL {
        if let inApp = Bundle.main.resourceURL?.appendingPathComponent("Market"),
           FileManager.default.fileExists(atPath: inApp.path) {
            return inApp
        }
        return bundled().deletingLastPathComponent().appendingPathComponent("market/src", isDirectory: true)
    }

    var mediaTemplate: URL { library.appendingPathComponent("_lib/media.html") }

    /// The kasuri files community wallpapers get injected, in load order.
    var kasuriScripts: [URL] {
        ["kasuri-core.js", "kasuri.js", "sky.js"].map { bundledWallpapers.appendingPathComponent("_lib/\($0)") }
    }
}
