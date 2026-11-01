import WebKit

/// Web features no wallpaper needs, switched off before any page loads.
///
/// The content rules in NetworkLock only cover loads WebKit routes through its
/// loader. WebRTC goes around them: a red-team scene got a STUN reply from the
/// internet over UDP. So peer connections are disabled in the engine itself,
/// and the constructors are removed from every frame as a second layer.
@MainActor
enum Lockdown {
    /// WKPreferences private switches (set through KVC like allowFileAccessFromFileURLs).
    /// Each is only set if this WebKit has it, so a renamed key can't crash the app.
    static let disabled = ["peerConnectionEnabled", "mediaDevicesEnabled", "DNSPrefetchingEnabled", "webTransportEnabled"]

    static func apply(to preferences: WKPreferences) {
        for key in disabled {
            let setter = NSSelectorFromString("_set\(key.prefix(1).uppercased())\(key.dropFirst()):")
            guard preferences.responds(to: setter) else {
                NSLog("tokonoma: this WebKit has no \(key) switch")
                continue
            }
            preferences.setValue(false, forKey: key)
        }
    }

    /// Belt and braces: the constructors are gone before the page's own scripts run.
    static let script = WKUserScript(source: """
    (() => {
      for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCIceCandidate',
                          'RTCSessionDescription', 'RTCRtpSender', 'RTCRtpReceiver', 'RTCRtpTransceiver',
                          'WebTransport', 'Worker', 'SharedWorker']) {
        try { Object.defineProperty(window, name, { value: undefined, writable: false, configurable: false }); } catch (e) {}
      }
    })();
    """, injectionTime: .atDocumentStart, forMainFrameOnly: false)
}
