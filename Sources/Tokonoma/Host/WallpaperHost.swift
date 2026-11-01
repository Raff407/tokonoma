import AppKit
import TokonomaCore
import WebKit

/// One WKWebView running one wallpaper page, plus the bridge to talk to it.
/// Remembers what it was last told (pause, fps) and repeats it once the page
/// reports ready, so calls made mid-load are never lost.
@MainActor
final class WallpaperHost: NSObject {
    let webView: WKWebView
    private(set) var wallpaperID: String?
    private(set) var properties: [String: PropertyValue] = [:]
    /// What the page booted with; anything newer is sent once it's ready.
    private var bootProperties: [String: PropertyValue] = [:]
    private var ready = false
    private var paused = false
    private var fps = 30
    private var scale = 2.0
    private var lastLoad: (wallpaper: Wallpaper, root: URL)?
    private var crashes: [Date] = []
    var onError: ((String) -> Void)?

    override init() {
        let config = WKWebViewConfiguration()
        // Imported videos and pictures are file:// too; without this the
        // canvas they're drawn into is tainted and WebGL refuses it.
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.mediaTypesRequiringUserActionForPlayback = []
        config.suppressesIncrementalRendering = true
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        webView.setValue(false, forKey: "drawsBackground")
        webView.underPageBackgroundColor = .black
        webView.navigationDelegate = self
        webView.configuration.userContentController.add(WeakMessageHandler(self), name: "tokonoma")
    }

    func load(_ wallpaper: Wallpaper, properties: [String: PropertyValue], root: URL) {
        wallpaperID = wallpaper.id
        self.properties = properties
        bootProperties = properties
        ready = false
        lastLoad = (wallpaper, root)
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()
        let props = (try? PropertyResolver.javascriptObject(properties)) ?? "{}"
        let boot = "window.__tokonoma = { properties: \(props), fps: \(fps), scale: \(scale) };"
        controller.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView.loadFileURL(wallpaper.entryURL, allowingReadAccessTo: root)
    }

    func apply(_ properties: [String: PropertyValue]) {
        guard properties != self.properties else { return }
        self.properties = properties
        guard ready, let json = try? PropertyResolver.javascriptObject(properties) else { return }
        call("apply(\(json))")
    }

    func setPaused(_ value: Bool) {
        guard value != paused else { return }
        paused = value
        if ready { call("setPaused(\(value))") }
    }

    func setFps(_ value: Int) {
        guard value != fps else { return }
        fps = value
        if ready { call("setFps(\(value))") }
    }

    /// Device pixels per point for the weave: 2 for Retina-sharp, 1 to save power.
    func setScale(_ value: Double) {
        guard value != scale else { return }
        scale = value
        if ready { call("setScale(\(value))") }
    }

    func pointer(x: Double, y: Double, active: Bool) {
        // A "cursor left" always goes through, even paused, or the page keeps a phantom cursor.
        guard ready, !paused || !active else { return }
        call(String(format: "pointer(%.4f,%.4f,%@)", x, y, active ? "true" : "false"))
    }

    func click(x: Double, y: Double) {
        guard ready, !paused else { return }
        call(String(format: "click(%.4f,%.4f)", x, y))
    }

    /// JPEG data URL of the current scene; nil if the page can't make one in time.
    func capture(width: Int, timeout: Duration = .seconds(8)) async -> String? {
        await withCheckedContinuation { continuation in
            var finished = false
            let finish: (String?) -> Void = { value in
                guard !finished else { return }
                finished = true
                continuation.resume(returning: value)
            }
            Task { @MainActor in
                let result = try? await self.webView.callAsyncJavaScript(
                    "return window.tokonoma ? await window.tokonoma.capture(w) : null",
                    arguments: ["w": width], in: nil, contentWorld: .page
                )
                finish(result as? String)
            }
            Task { @MainActor in
                try? await Task.sleep(for: timeout)
                finish(nil)
            }
        }
    }

    /// Drop the page entirely: frees its web process, GPU context and any timers.
    func unload() {
        wallpaperID = nil
        ready = false
        lastLoad = nil
        webView.configuration.userContentController.removeAllUserScripts()
        webView.loadHTMLString("", baseURL: nil)
    }

    var isReady: Bool { ready }

    private func call(_ expression: String) {
        webView.evaluateJavaScript("window.tokonoma && window.tokonoma.\(expression)") { _, error in
            if let error { NSLog("tokonoma: page call failed: \(error.localizedDescription)") }
        }
    }

    fileprivate func received(_ body: Any) {
        guard let message = body as? [String: Any], let type = message["type"] as? String else { return }
        switch type {
        case "ready":
            ready = true
            call("setFps(\(fps))")
            if paused { call("setPaused(true)") }
            if properties != bootProperties, let json = try? PropertyResolver.javascriptObject(properties) {
                call("apply(\(json))")
            }
        case "error":
            let text = message["message"] as? String ?? "unknown error"
            NSLog("tokonoma: wallpaper \(wallpaperID ?? "?") reported: \(text)")
            onError?(text)
        default:
            break
        }
    }
}

extension WallpaperHost: WKNavigationDelegate {
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // The web process can die under memory pressure; bring the wallpaper back,
        // but give up on a page that keeps dying rather than thrash.
        let now = Date()
        crashes = crashes.filter { now.timeIntervalSince($0) < 60 } + [now]
        guard crashes.count <= 3 else {
            onError?("\(wallpaperID ?? "This wallpaper") keeps crashing, so it has been stopped. Pick it again to retry.")
            return
        }
        NSLog("tokonoma: web process ended for \(wallpaperID ?? "?"), reloading")
        if let last = lastLoad { load(last.wallpaper, properties: properties, root: last.root) }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        report(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        report(error)
    }

    /// A new load interrupting an old one is normal, not something to show the user.
    private func report(_ error: Error) {
        let ns = error as NSError
        let cancelled = (ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled)
            || (ns.domain == "WebKitErrorDomain" && ns.code == 102)
        if !cancelled { onError?(error.localizedDescription) }
    }
}

/// WKUserContentController holds its handlers strongly; this breaks the cycle.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var host: WallpaperHost?

    init(_ host: WallpaperHost) {
        self.host = host
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        MainActor.assumeIsolated { host?.received(message.body) }
    }
}
