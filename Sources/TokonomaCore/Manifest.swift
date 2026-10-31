import Foundation

public enum ManifestError: Error, Equatable, CustomStringConvertible {
    case unreadable(String)
    case badID(String)
    case badEntry(String)
    case badProperty(String)
    case duplicateProperty(String)

    public var description: String {
        switch self {
        case let .unreadable(why): "wallpaper.json could not be read: \(why)"
        case let .badID(id): "\"\(id)\" is not a usable wallpaper id"
        case let .badEntry(entry): "entry \"\(entry)\" must be a file inside the wallpaper folder"
        case let .badProperty(key): "property \"\(key)\" is malformed (check its type, range and default)"
        case let .duplicateProperty(key): "property \"\(key)\" is declared twice"
        }
    }
}

public struct PropertySpec: Codable, Equatable, Hashable, Sendable {
    public enum Kind: String, Codable, Sendable {
        case range, choice, toggle, color
    }

    public let key: String
    public let label: String
    public let kind: Kind
    public let min: Double?
    public let max: Double?
    public let step: Double?
    public let options: [String]?
    public let defaultValue: PropertyValue

    enum CodingKeys: String, CodingKey {
        case key, label, min, max, step, options
        case kind = "type"
        case defaultValue = "default"
    }

    public init(key: String, label: String, kind: Kind, min: Double? = nil, max: Double? = nil,
                step: Double? = nil, options: [String]? = nil, defaultValue: PropertyValue) {
        self.key = key
        self.label = label
        self.kind = kind
        self.min = min
        self.max = max
        self.step = step
        self.options = options
        self.defaultValue = defaultValue
    }

    /// Everything the UI and the resolver rely on: a usable key, a sane range
    /// (both ends, finite, low ≤ high, positive step, default inside), and a
    /// default of the right type. Anything else could crash a Slider.
    var isWellFormed: Bool {
        guard !key.isEmpty, defaultMatchesKind else { return false }
        guard kind == .range else { return true }
        guard let lo = min, let hi = max, let d = defaultValue.number,
              lo.isFinite, hi.isFinite, d.isFinite, lo <= hi, (lo...hi).contains(d)
        else { return false }
        return step.map { $0.isFinite && $0 > 0 } ?? true
    }

    var defaultMatchesKind: Bool {
        switch kind {
        case .range: defaultValue.number != nil
        case .choice: defaultValue.text.map { options?.contains($0) ?? false } ?? false
        case .toggle: defaultValue.flag != nil
        case .color: defaultValue.text.map(HexColor.isValid) ?? false
        }
    }
}

/// wallpaper.json — what a wallpaper folder says about itself.
public struct Manifest: Codable, Equatable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let title: String?
    public let description: String?
    public let entry: String
    public let version: Int
    public let interactive: Bool
    public let media: String?
    public let properties: [PropertySpec]

    enum CodingKeys: String, CodingKey {
        case id, name, title, description, entry, version, interactive, media, properties
    }

    public init(id: String, name: String, title: String? = nil, description: String? = nil,
                entry: String = "index.html", version: Int = 1, interactive: Bool = false,
                media: String? = nil, properties: [PropertySpec] = []) {
        self.id = id
        self.name = name
        self.title = title
        self.description = description
        self.entry = entry
        self.version = version
        self.interactive = interactive
        self.media = media
        self.properties = properties
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        entry = try c.decode(String.self, forKey: .entry)
        version = try c.decodeIfPresent(Int.self, forKey: .version) ?? 1
        interactive = try c.decodeIfPresent(Bool.self, forKey: .interactive) ?? false
        media = try c.decodeIfPresent(String.self, forKey: .media)
        properties = try c.decodeIfPresent([PropertySpec].self, forKey: .properties) ?? []
    }

    public static func decode(_ data: Data) throws -> Manifest {
        let manifest: Manifest
        do {
            manifest = try JSONDecoder().decode(Manifest.self, from: data)
        } catch {
            throw ManifestError.unreadable(String(describing: error))
        }
        try manifest.validate()
        return manifest
    }

    public func encoded() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(self)
    }

    public func spec(for key: String) -> PropertySpec? {
        properties.first { $0.key == key }
    }

    func validate() throws {
        guard Manifest.isSafeName(id) else { throw ManifestError.badID(id) }
        guard Manifest.isSafeRelativePath(entry) else { throw ManifestError.badEntry(entry) }
        if let bad = properties.first(where: { !$0.isWellFormed }) {
            throw ManifestError.badProperty(bad.key)
        }
        var seen = Set<String>()
        for spec in properties where !seen.insert(spec.key).inserted {
            throw ManifestError.duplicateProperty(spec.key)
        }
    }

    /// Folder-safe names: no separators, no dot or underscore prefix (those are reserved).
    public static func isSafeName(_ name: String) -> Bool {
        guard let first = name.first, first != ".", first != "_" else { return false }
        return !name.contains("/") && !name.contains("\\") && !name.contains("..")
    }

    static func isSafeRelativePath(_ path: String) -> Bool {
        !path.isEmpty && !path.hasPrefix("/") && !path.split(separator: "/").contains("..")
    }
}

enum HexColor {
    static func isValid(_ text: String) -> Bool {
        let hex = text.hasPrefix("#") ? String(text.dropFirst()) : text
        return [3, 6].contains(hex.count) && hex.allSatisfy(\.isHexDigit)
    }
}
