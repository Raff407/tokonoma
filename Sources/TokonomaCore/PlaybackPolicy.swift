import Foundation

/// What the machine is doing right now, as far as a wallpaper cares.
public struct Conditions: Equatable, Sendable {
    public var covered: Bool
    public var onBattery: Bool
    public var lowPower: Bool
    public var screensAsleep: Bool
    public var sessionActive: Bool

    public init(covered: Bool, onBattery: Bool, lowPower: Bool, screensAsleep: Bool, sessionActive: Bool) {
        self.covered = covered
        self.onBattery = onBattery
        self.lowPower = lowPower
        self.screensAsleep = screensAsleep
        self.sessionActive = sessionActive
    }

    public static let idle = Conditions(covered: false, onBattery: false, lowPower: false, screensAsleep: false, sessionActive: true)

    public func with<T>(_ key: WritableKeyPath<Conditions, T>, _ value: T) -> Conditions {
        var copy = self
        copy[keyPath: key] = value
        return copy
    }
}

public enum PauseReason: String, Equatable, Sendable {
    case user, asleep, covered, battery, lowPower
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
        let cap = clamp(s.fpsCap)
        return .play(fps: c.onBattery ? min(cap, clamp(s.batteryFps)) : cap)
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
