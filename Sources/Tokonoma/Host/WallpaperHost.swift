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
    private var lastLoad: (wallpaper: Wallpaper, root: URL)?
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
        let boot = "window.__tokonoma = { properties: \(props), fps: \(fps) };"
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

    func pointer(x: Double, y: Double, active: Bool) {
        guard ready, !paused else { return }
        call(String(format: "pointer(%.4f,%.4f,%@)", x, y, active ? "true" : "false"))
    }

    /// JPEG data URL of the current scene; nil if the page can't make one.
    func capture(width: Int) async -> String? {
        let result = try? await webView.callAsyncJavaScript(
            "return window.tokonoma ? await window.tokonoma.capture(w) : null",
            arguments: ["w": width], in: nil, contentWorld: .page
        )
        return result as? String
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
        // The web process can die under memory pressure; bring the wallpaper back.
        NSLog("tokonoma: web process ended for \(wallpaperID ?? "?"), reloading")
        if let last = lastLoad { load(last.wallpaper, properties: properties, root: last.root) }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        onError?(error.localizedDescription)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        onError?(error.localizedDescription)
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
