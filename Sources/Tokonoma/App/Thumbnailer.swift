import AppKit
import TokonomaCore

/// Renders a still of each wallpaper in a hidden web view and caches it as a
/// JPEG, so the library can show real pictures without running every scene.
@MainActor
final class Thumbnailer {
    private let paths: Paths
    private let deliver: (String, NSImage) -> Void
    private let isolation: (Wallpaper) -> [String]?
    private var queue: [Wallpaper] = []
    private var busy = false
    private lazy var host: WallpaperHost = {
        let host = WallpaperHost()
        host.webView.frame = NSRect(x: 0, y: 0, width: 960, height: 600)
        host.setPaused(true)
        return host
    }()

    init(paths: Paths, isolation: @escaping (Wallpaper) -> [String]?, deliver: @escaping (String, NSImage) -> Void) {
        self.paths = paths
        self.isolation = isolation
        self.deliver = deliver
    }

    func render(_ wallpapers: [Wallpaper]) {
        for wallpaper in wallpapers {
            if let cached = NSImage(contentsOf: file(for: wallpaper)) {
                deliver(wallpaper.id, cached)
            } else if !queue.contains(wallpaper) {
                queue.append(wallpaper)
            }
        }
        Task { await drain() }
    }

    func forget(_ id: String) {
        let files = (try? FileManager.default.contentsOfDirectory(at: paths.thumbnails, includingPropertiesForKeys: nil)) ?? []
        for url in files where url.lastPathComponent.hasPrefix("\(id)@") {
            try? FileManager.default.removeItem(at: url)
        }
    }

    private func drain() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        while !queue.isEmpty {
            let wallpaper = queue.removeFirst()
            await renderOne(wallpaper)
        }
        // Nothing left to photograph: don't keep a scene running in a hidden view.
        host.unload()
    }

    private func renderOne(_ wallpaper: Wallpaper) async {
        await Poster.ensure(for: wallpaper)
        let defaults = PropertyResolver.resolve(wallpaper.manifest.properties, overrides: [:])
        host.load(wallpaper, properties: defaults, root: paths.library, isolation: isolation(wallpaper))
        for _ in 0..<50 where !host.isReady {
            try? await Task.sleep(for: .milliseconds(100))
        }
        guard host.isReady,
              let dataURL = await host.capture(width: 640),
              let comma = dataURL.firstIndex(of: ","),
              let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])),
              let image = NSImage(data: data)
        else {
            NSLog("tokonoma: no thumbnail for \(wallpaper.id)")
            return
        }
        do {
            try FileManager.default.createDirectory(at: paths.thumbnails, withIntermediateDirectories: true)
            try data.write(to: file(for: wallpaper), options: .atomic)
        } catch {
            NSLog("tokonoma: could not cache thumbnail for \(wallpaper.id): \(error)")
        }
        deliver(wallpaper.id, image)
    }

    /// Keyed by version and by when the folder's files last changed, so an edited
    /// scene or a new import that reuses an old name never shows a stale still.
    private func file(for wallpaper: Wallpaper) -> URL {
        let stamps = [wallpaper.entryURL, wallpaper.folder.appendingPathComponent(WallpaperLibrary.manifestName)]
            .compactMap { try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate }
        let changed = Int(stamps.max()?.timeIntervalSince1970 ?? 0)
        return paths.thumbnails.appendingPathComponent("\(wallpaper.id)@\(wallpaper.manifest.version)-\(changed).jpg")
    }
}
