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

    static func standard() -> Paths {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Tokonoma", isDirectory: true)
        return Paths(
            support: base,
            library: base.appendingPathComponent("Wallpapers", isDirectory: true),
            thumbnails: base.appendingPathComponent("Thumbnails", isDirectory: true),
            settings: base.appendingPathComponent("settings.json"),
            bundledWallpapers: bundled()
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

    var mediaTemplate: URL { library.appendingPathComponent("_lib/media.html") }
}
