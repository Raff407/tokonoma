import Foundation

/// Decides when a community wallpaper is using too much power, from CPU time
/// the app measures on its web process. The page can't see or fake this.
public struct PowerWatch: Sendable {
    /// Share of one core a wallpaper may use on average while playing, and while
    /// paused (when a well-behaved page does nothing at all).
    public static let playingBudget = 0.6
    public static let pausedBudget = 0.15
    /// Consecutive over-budget samples before the page is stopped (~30 s at 10 s a sample).
    public static let strikesAllowed = 3

    public private(set) var strikes = 0
    private var last: (cpu: Double, at: Double)?

    public init() {}

    /// Feed cumulative CPU seconds of the process at wall time `at` (seconds).
    /// Returns the share of a core used since the last sample, if there was one.
    public mutating func sample(cpuSeconds: Double, at: Double, paused: Bool) -> Double? {
        defer { last = (cpuSeconds, at) }
        guard let last, at > last.at, cpuSeconds >= last.cpu else { return nil }
        let share = (cpuSeconds - last.cpu) / (at - last.at)
        strikes = share > (paused ? Self.pausedBudget : Self.playingBudget) ? strikes + 1 : 0
        return share
    }

    public var shouldStop: Bool { strikes >= Self.strikesAllowed }
}
