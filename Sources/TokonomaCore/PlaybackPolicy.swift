import Foundation

/// What the machine is doing right now, as far as a wallpaper cares.
public struct Conditions: Equatable, Sendable {
    /// Mirrors ProcessInfo.ThermalState without importing it into the core.
    public enum Thermal: Int, Comparable, Sendable {
        case nominal, fair, serious, critical
        public static func < (a: Thermal, b: Thermal) -> Bool { a.rawValue < b.rawValue }
    }

    public var covered: Bool
    public var onBattery: Bool
    public var lowPower: Bool
    public var screensAsleep: Bool
    public var sessionActive: Bool
    public var thermal: Thermal

    public init(covered: Bool, onBattery: Bool, lowPower: Bool, screensAsleep: Bool, sessionActive: Bool, thermal: Thermal = .nominal) {
        self.covered = covered
        self.onBattery = onBattery
        self.lowPower = lowPower
        self.screensAsleep = screensAsleep
        self.sessionActive = sessionActive
        self.thermal = thermal
    }

    public static let idle = Conditions(covered: false, onBattery: false, lowPower: false, screensAsleep: false, sessionActive: true)

    public func with<T>(_ key: WritableKeyPath<Conditions, T>, _ value: T) -> Conditions {
        var copy = self
        copy[keyPath: key] = value
        return copy
    }
}

public enum PauseReason: String, Equatable, Sendable {
    case user, asleep, covered, battery, lowPower, hot
}

public enum Playback: Equatable, Sendable {
    case play(fps: Int)
    case pause(PauseReason)

    public var isPlaying: Bool { if case .play = self { true } else { false } }
}

/// The one place that decides whether a wallpaper animates and how fast.
public enum PlaybackPolicy {
    public static let fpsRange = 1...120

    public static func decide(_ c: Conditions, _ s: Settings) -> Playback {
        if s.userPaused { return .pause(.user) }
        if c.screensAsleep || !c.sessionActive { return .pause(.asleep) }
        if c.covered && s.pauseWhenCovered { return .pause(.covered) }
        if c.lowPower && s.pauseInLowPower { return .pause(.lowPower) }
        if c.onBattery && s.pauseOnBattery { return .pause(.battery) }
        if c.thermal >= .critical { return .pause(.hot) }
        var fps = clamp(s.fpsCap)
        if c.onBattery { fps = min(fps, clamp(s.batteryFps)) }
        if c.thermal >= .serious { fps = max(fpsRange.lowerBound, fps / 2) }
        return .play(fps: fps)
    }

    /// Device pixels per point for the weave. Retina sharpness costs GPU time,
    /// so it is the first thing to go when power or heat is short.
    public static func renderScale(_ c: Conditions, _ s: Settings) -> Double {
        let saving = (c.onBattery && !s.sharpOnBattery) || c.lowPower || c.thermal >= .serious
        return saving ? 1 : 2
    }

    private static func clamp(_ fps: Int) -> Int {
        min(max(fps, fpsRange.lowerBound), fpsRange.upperBound)
    }
}

public enum Rotation {
    public static func next(after current: String, in ids: [String]) -> String? {
        guard !ids.isEmpty else { return nil }
        guard let i = ids.firstIndex(of: current) else { return ids[0] }
        return ids[(i + 1) % ids.count]
    }
}
