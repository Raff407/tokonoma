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
    private var lastLoad: (wallpaper: Wallpaper, root: URL, isolation: [String]?)?
    private var crashes: [Date] = []
    /// One error report per page load: a page can't flood the app with notices.
    private var reportedError = false
    var onError: ((String) -> Void)?

    override init() {
        let config = WKWebViewConfiguration()
        // Imported videos and pictures are file:// too; without this the
        // canvas they're drawn into is tainted and WebGL refuses it.
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.mediaTypesRequiringUserActionForPlayback = []
        config.suppressesIncrementalRendering = true
        Lockdown.apply(to: config.preferences)
        NetworkLock.apply(to: config.userContentController)
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        webView.setValue(false, forKey: "drawsBackground")
        webView.underPageBackgroundColor = .black
        webView.navigationDelegate = self
        webView.configuration.userContentController.add(WeakMessageHandler(self), name: "tokonoma")
    }

    /// `isolation` is for community wallpapers: the trusted kasuri scripts are
    /// injected from here and the page may read only its own folder, so it
    /// never sees the rest of the library or your imported files.
    func load(_ wallpaper: Wallpaper, properties: [String: PropertyValue], root: URL, isolation: [String]? = nil) {
        if isolation != nil && !NetworkLock.isReady {
            onError?("\(wallpaper.name) wasn't started because the network block isn't ready yet.")
            return
        }
        wallpaperID = wallpaper.id
        self.properties = properties
        bootProperties = properties
        ready = false
        reportedError = false
        lastLoad = (wallpaper, root, isolation)
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()
        controller.addUserScript(Lockdown.script)
        let props = (try? PropertyResolver.javascriptObject(properties)) ?? "{}"
        let boot = "window.__tokonoma = { properties: \(props), fps: \(fps), scale: \(scale) };"
        controller.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        for script in isolation ?? [] {
            controller.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        webView.loadFileURL(wallpaper.entryURL, allowingReadAccessTo: isolation == nil ? root : wallpaper.folder)
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
                finish(Self.plausibleJPEG(result as? String))
            }
            Task { @MainActor in
                try? await Task.sleep(for: timeout)
                finish(nil)
            }
        }
    }

    /// The page makes the capture, so it's untrusted bytes headed for a native
    /// image decoder: only a modest data URL that really starts like a JPEG passes.
    static let maxCaptureBytes = 4 * 1024 * 1024
    static func plausibleJPEG(_ dataURL: String?) -> String? {
        let prefix = "data:image/jpeg;base64,"
        guard let dataURL, dataURL.hasPrefix(prefix), dataURL.utf8.count < maxCaptureBytes * 4 / 3 + 64,
              let head = Data(base64Encoded: String(dataURL.dropFirst(prefix.count).prefix(8))),
              head.starts(with: [0xFF, 0xD8, 0xFF])
        else { return nil }
        return dataURL
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
            let text = String((message["message"] as? String ?? "unknown error").prefix(300))
            NSLog("tokonoma: wallpaper \(wallpaperID ?? "?") reported: \(text)")
            guard !reportedError else { return }
            reportedError = true
            // Words from a community page never reach the app's own UI: it could
            // otherwise pose as Tokonoma ("your Mac is infected, call…").
            if let last = lastLoad, last.isolation != nil {
                onError?("\(last.wallpaper.name) stopped with a script error.")
            } else {
                onError?(text)
            }
        default:
            break
        }
    }
}

extension WallpaperHost: WKNavigationDelegate {
    /// A wallpaper page may only ever be itself: no navigating away, no custom
    /// URL schemes that open other apps, no frames, no new windows.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        decisionHandler(allows(action) ? .allow : .cancel)
    }

    private func allows(_ action: WKNavigationAction) -> Bool {
        guard action.targetFrame?.isMainFrame == true, let url = action.request.url else { return false }
        if url.absoluteString == "about:blank" { return true }
        guard url.isFileURL, let entry = lastLoad?.wallpaper.entryURL else { return false }
        return url.standardizedFileURL.path == entry.standardizedFileURL.path
    }

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
        if let last = lastLoad { load(last.wallpaper, properties: properties, root: last.root, isolation: last.isolation) }
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
