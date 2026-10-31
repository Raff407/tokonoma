import Foundation

/// Turns a manifest's declared properties plus the user's saved tweaks into
/// the exact values a wallpaper page receives. Anything out of range or of
/// the wrong shape quietly becomes the default rather than reaching the page.
public enum PropertyResolver {
    public static func resolve(_ specs: [PropertySpec], overrides: [String: PropertyValue]) -> [String: PropertyValue] {
        // First declaration wins; never trap on a duplicate that slipped past validation.
        Dictionary(specs.map { spec in
            (spec.key, overrides[spec.key].map { sanitize($0, for: spec) } ?? spec.defaultValue)
        }, uniquingKeysWith: { first, _ in first })
    }

    public static func sanitize(_ value: PropertyValue, for spec: PropertySpec) -> PropertyValue {
        switch spec.kind {
        case .range:
            guard let n = value.number, n.isFinite else { return spec.defaultValue }
            return .number(snap(n, spec))
        case .choice:
            guard let t = value.text, spec.options?.contains(t) == true else { return spec.defaultValue }
            return .text(t)
        case .toggle:
            return value.flag.map(PropertyValue.flag) ?? spec.defaultValue
        case .color:
            guard let t = value.text, HexColor.isValid(t) else { return spec.defaultValue }
            return .text(t.hasPrefix("#") ? t : "#" + t)
        }
    }

    private static func snap(_ n: Double, _ spec: PropertySpec) -> Double {
        let lo = spec.min ?? -.greatestFiniteMagnitude
        let hi = spec.max ?? .greatestFiniteMagnitude
        var v = Swift.min(Swift.max(n, lo), hi)
        if let step = spec.step, step > 0 {
            let base = spec.min ?? 0
            v = base + ((v - base) / step).rounded() * step
            // Undo float fuzz like 0.30000000000000004.
            v = (v * 1e6).rounded() / 1e6
            v = Swift.min(Swift.max(v, lo), hi)
        }
        return v
    }

    /// JSON object literal safe to splice into a <script> or evaluateJavaScript call.
    public static func javascriptObject(_ values: [String: PropertyValue]) throws -> String {
        let plain = values.mapValues(\.jsonObject)
        let data = try JSONSerialization.data(withJSONObject: plain, options: [.sortedKeys])
        let text = String(decoding: data, as: UTF8.self)
        // "</" can close a script tag early; an escaped slash means the same thing to JSON.
        return text.replacingOccurrences(of: "</", with: "<\\/")
    }
}
