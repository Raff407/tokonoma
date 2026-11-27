import Foundation

/// Where things live on disk.
///   ~/Library/Application Support/Tokonoma/
///     Wallpapers/   built-ins (refreshed each launch) + your imports
///     Thumbnails/   cached library stills
///     Models/       the compiled nudity-screen model, when not bundled
///     settings.json
struct Paths {
    let support: URL
    let library: URL
    let thumbnails: URL
    let settings: URL
    let bundledWallpapers: URL
    /// rules.js + validate.js, shared with the MCP server.
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

    /// The market package (validator, MCP server) ships in Resources/market;
    /// it sits beside Resources/Wallpapers so its relative paths still work.
    private static func market() -> URL {
        if let inApp = Bundle.main.resourceURL?.appendingPathComponent("market/src"),
           FileManager.default.fileExists(atPath: inApp.path) {
            return inApp
        }
        return bundled().deletingLastPathComponent().appendingPathComponent("market/src", isDirectory: true)
    }

    var mcpServer: URL { marketScripts.appendingPathComponent("server.js") }

    var modelCache: URL { support.appendingPathComponent("Models", isDirectory: true) }

    /// Compiled inside the .app (bundle.sh); the raw model in the repo under `swift run`.
    var nsfwModel: URL {
        if let inApp = Bundle.main.resourceURL?.appendingPathComponent("Models/NSFW.mlmodelc"),
           FileManager.default.fileExists(atPath: inApp.path) {
            return inApp
        }
        return bundledWallpapers.deletingLastPathComponent().appendingPathComponent("Resources/Models/NSFW.mlmodel")
    }

    /// The media player, injected into shared clips and pictures like kasuri is into scenes.
    var mediaScript: URL { bundledWallpapers.appendingPathComponent("_lib/media.js") }

    var mediaTemplate: URL { library.appendingPathComponent("_lib/media.html") }

    /// The kasuri files community wallpapers get injected, in load order.
    var kasuriScripts: [URL] {
        ["kasuri-core.js", "kasuri.js", "sky.js"].map { bundledWallpapers.appendingPathComponent("_lib/\($0)") }
    }
}
