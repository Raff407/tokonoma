import Foundation

/// A single setting a wallpaper exposes, as it travels through JSON.
public enum PropertyValue: Equatable, Hashable, Sendable {
    case number(Double)
    case text(String)
    case flag(Bool)

    public var number: Double? { if case let .number(v) = self { v } else { nil } }
    public var text: String? { if case let .text(v) = self { v } else { nil } }
    public var flag: Bool? { if case let .flag(v) = self { v } else { nil } }

    /// Plain Foundation value, ready for JSONSerialization.
    public var jsonObject: Any {
        switch self {
        case let .number(v): v
        case let .text(v): v
        case let .flag(v): v
        }
    }
}

extension PropertyValue: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        // Bool first: JSON true would otherwise sneak through as 1.
        if let v = try? container.decode(Bool.self) {
            self = .flag(v)
        } else if let v = try? container.decode(Double.self) {
            self = .number(v)
        } else if let v = try? container.decode(String.self) {
            self = .text(v)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Expected a number, string or bool")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case let .number(v): try container.encode(v)
        case let .text(v): try container.encode(v)
        case let .flag(v): try container.encode(v)
        }
    }
}
