// Times every wallpaper inside real WebKit (the engine the app uses), so a
// heavy scene shows up before it reaches anyone's battery.
// usage: xcrun swift scripts/bench.swift [wallpaper ...]
import AppKit
import WebKit

let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
    .appendingPathComponent("Wallpapers")
let names = CommandLine.arguments.dropFirst().isEmpty ? ["torii", "koi", "sumi", "fuji", "kaze", "take", "sakura", "yuki", "hotaru", "tsuki", "nami", "niwa", "momiji", "hoshi", "toro", "unkai", "tsuru", "neko", "hanabi", "shoji", "hasu", "kiri", "densha", "kurage", "suisha"] : Array(CommandLine.arguments.dropFirst())

@MainActor
func bench(_ name: String) async -> String {
    let config = WKWebViewConfiguration()
    config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
    let view = WKWebView(frame: NSRect(x: 0, y: 0, width: 1512, height: 982), configuration: config)
    let start = Date()
    view.loadFileURL(root.appendingPathComponent("\(name)/index.html"), allowingReadAccessTo: root)
    for _ in 0..<100 {
        try? await Task.sleep(for: .milliseconds(50))
        if (try? await view.evaluateJavaScript("!!window.tokonoma")) as? Bool == true { break }
    }
    let boot = Date().timeIntervalSince(start)
    let script = """
    window.tokonoma.setPaused(true);
    const blocks = [];
    for (let k = 0; k < 4; k++) {
      const t0 = performance.now();
      window.tokonoma.step(1 / 30, 90);
      blocks.push((performance.now() - t0) / 90);
    }
    return blocks;
    """
    let result = try? await view.callAsyncJavaScript(script, arguments: [:], in: nil, contentWorld: .page)
    let blocks = (result as? [Double]) ?? []
    let worst = blocks.max() ?? .nan
    let mean = blocks.isEmpty ? .nan : blocks.reduce(0, +) / Double(blocks.count)
    return String(format: "%-6@ boot %5.0f ms   mean %5.2f ms/frame   worst block %5.2f ms/frame", name as NSString, boot * 1000, mean, worst)
}

let app = NSApplication.shared
Task { @MainActor in
    for name in names { print(await bench(name)) }
    exit(0)
}
app.run()
