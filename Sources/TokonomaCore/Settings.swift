import Foundation

/// Everything the user has chosen. Value type; every change returns a copy.
public struct Settings: Codable, Equatable, Sendable {
    /// Display UUID → wallpaper id. Displays not listed show `fallbackWallpaper`.
    public var assignments: [String: String]
    public var fallbackWallpaper: String
    /// Wallpaper id → property key → value.
    public var overrides: [String: [String: PropertyValue]]
    public var pauseWhenCovered: Bool
    public var pauseOnBattery: Bool
    public var pauseInLowPower: Bool
    public var fpsCap: Int
    public var batteryFps: Int
    /// 0 means never rotate.
    public var rotateMinutes: Int
    public var followCursor: Bool
    public var userPaused: Bool
    /// Keep Retina-sharp glyphs on battery (costs GPU time).
    public var sharpOnBattery: Bool
    /// Starred wallpaper ids, in the order they were starred.
    public var favourites: [String]

    public static let `default` = Settings(
        assignments: [:],
        fallbackWallpaper: "torii",
        overrides: [:],
        pauseWhenCovered: true,
        pauseOnBattery: false,
        pauseInLowPower: true,
        fpsCap: 30,
        batteryFps: 15,
        rotateMinutes: 0,
        followCursor: true,
        userPaused: false,
        sharpOnBattery: false,
        favourites: []
    )

    public func wallpaper(for display: String) -> String {
        assignments[display] ?? fallbackWallpaper
    }

    public func with<T>(_ key: WritableKeyPath<Settings, T>, _ value: T) -> Settings {
        var copy = self
        copy[keyPath: key] = value
        return copy
    }

    public func assigning(_ wallpaper: String, to display: String) -> Settings {
        with(\.assignments, assignments.merging([display: wallpaper]) { _, new in new })
    }

    public func assigningEverywhere(_ wallpaper: String) -> Settings {
        with(\.assignments, [:]).with(\.fallbackWallpaper, wallpaper)
    }

    public func setting(_ key: String, to value: PropertyValue, for wallpaper: String) -> Settings {
        let current = overrides[wallpaper] ?? [:]
        return with(\.overrides, overrides.merging([wallpaper: current.merging([key: value]) { _, new in new }]) { _, new in new })
    }

    public func resetting(_ wallpaper: String) -> Settings {
        with(\.overrides, overrides.filter { $0.key != wallpaper })
    }

    /// After a wallpaper is deleted: point anything that showed it somewhere else.
    public func forgetting(_ wallpaper: String, fallback: String) -> Settings {
        resetting(wallpaper)
            .with(\.assignments, assignments.filter { $0.value != wallpaper })
            .with(\.fallbackWallpaper, fallbackWallpaper == wallpaper ? fallback : fallbackWallpaper)
            .with(\.favourites, favourites.filter { $0 != wallpaper })
    }

    // MARK: Favourites

    public func isFavourite(_ wallpaper: String) -> Bool {
        favourites.contains(wallpaper)
    }

    public func togglingFavourite(_ wallpaper: String) -> Settings {
        with(\.favourites, isFavourite(wallpaper) ? favourites.filter { $0 != wallpaper } : favourites + [wallpaper])
    }

    /// Starred wallpapers that are still in the library, in library order.
    public func favourites(in library: [String]) -> [String] {
        library.filter(isFavourite)
    }

    /// What Next and timed rotation step through: your favourites once there
    /// are two to move between, otherwise everything.
    public func rotationPool(in library: [String]) -> [String] {
        let starred = favourites(in: library)
        return starred.count >= 2 ? starred : library
    }
}

extension Settings {
    private enum Keys: String, CodingKey {
        case assignments, fallbackWallpaper, overrides, pauseWhenCovered, pauseOnBattery, pauseInLowPower
        case fpsCap, batteryFps, rotateMinutes, followCursor, userPaused, sharpOnBattery, favourites
    }

    // Tolerant decoding: a settings file from an older build fills gaps with defaults.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        let d = Settings.default
        assignments = try c.decodeIfPresent([String: String].self, forKey: .assignments) ?? d.assignments
        fallbackWallpaper = try c.decodeIfPresent(String.self, forKey: .fallbackWallpaper) ?? d.fallbackWallpaper
        overrides = try c.decodeIfPresent([String: [String: PropertyValue]].self, forKey: .overrides) ?? d.overrides
        pauseWhenCovered = try c.decodeIfPresent(Bool.self, forKey: .pauseWhenCovered) ?? d.pauseWhenCovered
        pauseOnBattery = try c.decodeIfPresent(Bool.self, forKey: .pauseOnBattery) ?? d.pauseOnBattery
        pauseInLowPower = try c.decodeIfPresent(Bool.self, forKey: .pauseInLowPower) ?? d.pauseInLowPower
        fpsCap = try c.decodeIfPresent(Int.self, forKey: .fpsCap) ?? d.fpsCap
        batteryFps = try c.decodeIfPresent(Int.self, forKey: .batteryFps) ?? d.batteryFps
        rotateMinutes = try c.decodeIfPresent(Int.self, forKey: .rotateMinutes) ?? d.rotateMinutes
        followCursor = try c.decodeIfPresent(Bool.self, forKey: .followCursor) ?? d.followCursor
        userPaused = try c.decodeIfPresent(Bool.self, forKey: .userPaused) ?? d.userPaused
        sharpOnBattery = try c.decodeIfPresent(Bool.self, forKey: .sharpOnBattery) ?? d.sharpOnBattery
        favourites = try c.decodeIfPresent([String].self, forKey: .favourites) ?? d.favourites
    }
}

/// Reads and writes settings.json. Corrupt or missing files fall back to defaults.
public struct SettingsStore: Sendable {
    public let url: URL

    public init(url: URL) {
        self.url = url
    }

    public func load() -> Settings {
        loadRecovering().settings
    }

    /// Like `load`, but a file that exists and can't be read is moved aside
    /// (settings.broken-<time>.json) instead of being silently overwritten later.
    /// The second value is where it went, so the app can say so.
    public func loadRecovering() -> (settings: Settings, backup: URL?) {
        guard let data = try? Data(contentsOf: url) else { return (.default, nil) }
        if let settings = try? JSONDecoder().decode(Settings.self, from: data) { return (settings, nil) }
        let stamp = Int(Date().timeIntervalSince1970)
        let backup = url.deletingLastPathComponent().appendingPathComponent("settings.broken-\(stamp).json")
        do {
            try FileManager.default.moveItem(at: url, to: backup)
            return (.default, backup)
        } catch {
            return (.default, nil)
        }
    }

    public func save(_ settings: Settings) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try encoder.encode(settings).write(to: url, options: .atomic)
    }
}
