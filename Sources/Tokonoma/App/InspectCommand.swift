import AppKit
import TokonomaCore

/// `Tokonoma --inspect <folder> [--out still.jpg]`
///
/// Renders a wallpaper folder headless, in the same WebKit and the same
/// isolation a community install gets, then prints one line of JSON with the
/// metrics the marketplace judges (motion, flashing, coverage, palette, cost).
/// The MCP server calls this; no windows open, nothing touches your desktop.
enum InspectError: Error, CustomStringConvertible {
    case neverStarted(String)

    var description: String {
        switch self {
        case let .neverStarted(probe): "The scene never started. Check scene.js for errors. (\(probe))"
        }
    }
}

@MainActor
enum InspectCommand {
    static var requested: Bool { CommandLine.arguments.contains("--inspect") }

    static func run() {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        Task { @MainActor in
            exit(await inspectAndPrint())
        }
        app.run()
    }

    private static func argument(after flag: String) -> String? {
        let args = CommandLine.arguments
        guard let i = args.firstIndex(of: flag), i + 1 < args.count else { return nil }
        return args[i + 1]
    }

    private static func inspectAndPrint() async -> Int32 {
        do {
            guard let folder = argument(after: "--inspect") else { throw CommunityError.badFile("no folder given") }
            let result = try await inspect(URL(fileURLWithPath: folder), out: argument(after: "--out").map(URL.init(fileURLWithPath:)))
            print(String(decoding: try JSONSerialization.data(withJSONObject: ["metrics": result]), as: UTF8.self))
            return 0
        } catch {
            let message = (error as? CustomStringConvertible)?.description ?? error.localizedDescription
            print(String(decoding: (try? JSONSerialization.data(withJSONObject: ["error": message])) ?? Data(), as: UTF8.self))
            return 1
        }
    }

    private static func inspect(_ folder: URL, out: URL?) async throws -> [String: Any] {
        await NetworkLock.prepare()
        let paths = Paths.standard()
        let staging = try stage(folder)
        defer { try? FileManager.default.removeItem(at: staging) }

        let manifest = try Manifest.decode(Data(contentsOf: staging.appendingPathComponent(WallpaperLibrary.manifestName)))
        let wallpaper = Wallpaper(manifest: manifest, folder: staging, isBuiltIn: false)
        let scripts = try paths.kasuriScripts.map { try String(contentsOf: $0, encoding: .utf8) }

        let host = WallpaperHost()
        host.webView.frame = NSRect(x: 0, y: 0, width: 1512, height: 982)
        host.setPaused(true)
        host.load(wallpaper, properties: PropertyResolver.resolve(manifest.properties, overrides: [:]), root: staging, isolation: scripts)
        for _ in 0..<80 where !host.isReady {
            try await Task.sleep(for: .milliseconds(100))
        }
        guard host.isReady else {
            let probe = try? await host.webView.evaluateJavaScript(
                "JSON.stringify({ kasuri: typeof Kasuri, core: typeof KasuriCore, host: typeof window.tokonoma, state: document.readyState, url: location.href })"
            )
            throw InspectError.neverStarted(probe as? String ?? "page didn't answer")
        }

        let metrics = try await host.webView.callAsyncJavaScript(
            "return await window.tokonoma.inspect()", arguments: [:], in: nil, contentWorld: .page
        ) as? [String: Any] ?? [:]
        if let out, let dataURL = await host.capture(width: 1024),
           let comma = dataURL.firstIndex(of: ","),
           let jpeg = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])) {
            try jpeg.write(to: out)
        }
        return metrics
    }

    /// Copies only what a package may contain, then writes the trusted page.
    private static func stage(_ folder: URL) throws -> URL {
        let fm = FileManager.default
        let staging = fm.temporaryDirectory.appendingPathComponent("tokonoma-inspect-\(UUID().uuidString)")
        try fm.createDirectory(at: staging.appendingPathComponent("assets"), withIntermediateDirectories: true)
        for name in ["scene.js", "README.md"] where fm.fileExists(atPath: folder.appendingPathComponent(name).path) {
            try fm.copyItem(at: folder.appendingPathComponent(name), to: staging.appendingPathComponent(name))
        }
        let assets = (try? fm.contentsOfDirectory(at: folder.appendingPathComponent("assets"), includingPropertiesForKeys: nil)) ?? []
        for asset in assets where ["png", "jpg", "jpeg", "webp"].contains(asset.pathExtension.lowercased()) {
            try fm.copyItem(at: asset, to: staging.appendingPathComponent("assets/\(asset.lastPathComponent)"))
        }
        var manifest = (try JSONSerialization.jsonObject(with: Data(contentsOf: folder.appendingPathComponent(WallpaperLibrary.manifestName))) as? [String: Any]) ?? [:]
        manifest["entry"] = "index.html"
        manifest["media"] = nil
        try JSONSerialization.data(withJSONObject: manifest).write(to: staging.appendingPathComponent(WallpaperLibrary.manifestName))
        try Data(CommunityInstaller.page(title: manifest["name"] as? String ?? "Preview").utf8)
            .write(to: staging.appendingPathComponent("index.html"))
        return staging
    }
}
