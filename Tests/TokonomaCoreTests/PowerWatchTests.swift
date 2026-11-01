import Testing
@testable import TokonomaCore

@Suite struct PowerWatchTests {
    @Test func aCalmPageIsLeftAlone() {
        var watch = PowerWatch()
        for i in 0..<20 { _ = watch.sample(cpuSeconds: Double(i) * 0.5, at: Double(i) * 10, paused: false) }
        #expect(!watch.shouldStop)
    }

    @Test func aPageThatSpinsForHalfAMinuteIsStopped() {
        var watch = PowerWatch()
        _ = watch.sample(cpuSeconds: 0, at: 0, paused: false)
        #expect(watch.sample(cpuSeconds: 9.5, at: 10, paused: false) == 0.95)
        _ = watch.sample(cpuSeconds: 19, at: 20, paused: false)
        #expect(!watch.shouldStop)
        _ = watch.sample(cpuSeconds: 28.5, at: 30, paused: false)
        #expect(watch.shouldStop)
    }

    @Test func pausedPagesGetAMuchSmallerBudget() {
        var watch = PowerWatch()
        _ = watch.sample(cpuSeconds: 0, at: 0, paused: true)
        for i in 1...3 { _ = watch.sample(cpuSeconds: Double(i) * 3, at: Double(i) * 10, paused: true) }
        #expect(watch.shouldStop)
    }

    @Test func oneBusyMomentIsForgiven() {
        var watch = PowerWatch()
        _ = watch.sample(cpuSeconds: 0, at: 0, paused: false)
        _ = watch.sample(cpuSeconds: 9, at: 10, paused: false)
        _ = watch.sample(cpuSeconds: 10, at: 20, paused: false)
        _ = watch.sample(cpuSeconds: 19, at: 30, paused: false)
        #expect(!watch.shouldStop)
    }
}
