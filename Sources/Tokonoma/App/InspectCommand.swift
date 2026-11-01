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
        let warm = argument(after: "--warm").map(URL.init(fileURLWithPath:))
        let staging = try stage(folder, inside: warm)
        defer { try? FileManager.default.removeItem(at: staging) }

        let manifest = try Manifest.decode(Data(contentsOf: staging.appendingPathComponent(WallpaperLibrary.manifestName)))
        let wallpaper = Wallpaper(manifest: manifest, folder: staging, isBuiltIn: false)
        let scripts = try paths.kasuriScripts.map { try String(contentsOf: $0, encoding: .utf8) }

        let host = WallpaperHost()
        host.view.frame = NSRect(x: 0, y: 0, width: 1512, height: 982)
        host.setPaused(true)
        // --warm <library folder>: run a trusted page in this host first, the way the
        // desktop or thumbnailer would, so the red team can check nothing carries over.
        if let warm, let first = WallpaperLibrary.scan(warm, builtIn: []).wallpapers.first {
            host.load(first, properties: [:], root: warm)
            for _ in 0..<50 where !host.isReady { try await Task.sleep(for: .milliseconds(100)) }
        }
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

        let cpuBefore = host.cpuSeconds()
        let wallBefore = ProcessInfo.processInfo.systemUptime
        var metrics = try await host.webView.callAsyncJavaScript(
            "return await window.tokonoma.inspect()", arguments: [:], in: nil, contentWorld: .page
        ) as? [String: Any] ?? [:]
        // Measured by the app on the web process, so a scene can't flatter itself.
        if let before = cpuBefore, let after = host.cpuSeconds() {
            metrics["cpuSeconds"] = after - before
            metrics["wallSeconds"] = ProcessInfo.processInfo.systemUptime - wallBefore
        }
        let still = await host.capture(width: 1024).flatMap { dataURL -> Data? in
            guard let comma = dataURL.firstIndex(of: ",") else { return nil }
            return Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...]))
        }
        if let out, let still { try still.write(to: out) }
        // --probe: the red-team scene's own report (window.__redteam), kept apart from the metrics.
        if CommandLine.arguments.contains("--probe") {
            metrics["probe"] = try? await host.webView.callAsyncJavaScript(
                "return window.__redteam ? await window.__redteam : null", arguments: [:], in: nil, contentWorld: .page
            )
        }
        if let verdict = await screen(still: still, assets: staging.appendingPathComponent("assets"), paths: paths) {
            metrics["nsfw"] = verdict.nsfw
            metrics["screenedFrames"] = verdict.frames
        }
        return metrics
    }

    /// The rendered still and every image asset through the nudity screen.
    /// nil (no score) when the model can't load, so the registry says "not run".
    private static func screen(still: Data?, assets: URL, paths: Paths) async -> SafetyVerdict? {
        guard let screen = try? await SafetyScreen.load(model: paths.nsfwModel, cache: paths.modelCache) else { return nil }
        var verdict = SafetyVerdict.empty
        if let still, let seen = try? screen.screen(picture: still, name: "render") { verdict = verdict.merged(seen) }
        for asset in (try? FileManager.default.contentsOfDirectory(at: assets, includingPropertiesForKeys: nil)) ?? [] {
            if let data = try? Data(contentsOf: asset), let seen = try? screen.screen(picture: data, name: asset.lastPathComponent) {
                verdict = verdict.merged(seen)
            }
        }
        return verdict.frames > 0 ? verdict : nil
    }

    /// Copies only what a package may contain, then writes the trusted page.
    private static func stage(_ folder: URL, inside parent: URL? = nil) throws -> URL {
        let fm = FileManager.default
        let staging = (parent ?? fm.temporaryDirectory).appendingPathComponent("tokonoma-inspect-\(UUID().uuidString)")
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
