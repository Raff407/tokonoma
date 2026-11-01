import WebKit

/// A content rule that blocks every network request from every wallpaper.
/// Wallpapers only ever need their own files, so this costs nothing and means
/// a community scene that slipped past the static checks still can't phone home.
@MainActor
enum NetworkLock {
    private static var rules: WKContentRuleList?

    static func prepare() async {
        guard rules == nil else { return }
        // Block every URL, then let back only what never leaves the Mac. Rules
        // apply in order; WebKit's regexes have no alternation, so one per scheme.
        let block = #"{"trigger":{"url-filter":".*"},"action":{"type":"block"}}"#
        let local = ["^file:", "^data:", "^blob:", "^about:"]
            .map { #"{"trigger":{"url-filter":"\#($0)"},"action":{"type":"ignore-previous-rules"}}"# }
        let json = ([block] + local).joined(separator: ",").wrapped("[", "]")
        do {
            rules = try await WKContentRuleListStore.default().compileContentRuleList(
                forIdentifier: "tokonoma.offline.v2", encodedContentRuleList: json
            )
        } catch {
            NSLog("tokonoma: network lock failed to compile: \(error)")
        }
    }

    /// True once the rule exists; community wallpapers refuse to load before then.
    static var isReady: Bool { rules != nil }

    static func apply(to controller: WKUserContentController) {
        if let rules { controller.add(rules) }
    }
}

private extension String {
    func wrapped(_ open: String, _ close: String) -> String { open + self + close }
}
