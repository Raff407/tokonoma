import Testing
@testable import TokonomaCore

@Suite struct PlaybackPolicyTests {
    let calm = Conditions(covered: false, onBattery: false, lowPower: false, screensAsleep: false, sessionActive: true)

    @Test func playsAtTheCapWhenNothingIsInTheWay() {
        #expect(PlaybackPolicy.decide(calm, .default) == .play(fps: 30))
    }

    @Test func pausesWhenCoveredOnlyIfAsked() {
        let covered = calm.with(\.covered, true)
        #expect(PlaybackPolicy.decide(covered, .default) == .pause(.covered))
        #expect(PlaybackPolicy.decide(covered, Settings.default.with(\.pauseWhenCovered, false)) == .play(fps: 30))
    }

    @Test func batteryEitherPausesOrSlowsDown() {
        let battery = calm.with(\.onBattery, true)
        #expect(PlaybackPolicy.decide(battery, .default) == .play(fps: 15))
        #expect(PlaybackPolicy.decide(battery, Settings.default.with(\.pauseOnBattery, true)) == .pause(.battery))
    }

    @Test func batteryNeverSpeedsThingsUp() {
        let battery = calm.with(\.onBattery, true)
        let s = Settings.default.with(\.fpsCap, 10).with(\.batteryFps, 60)
        #expect(PlaybackPolicy.decide(battery, s) == .play(fps: 10))
    }

    @Test func lowPowerModeIsRespected() {
        #expect(PlaybackPolicy.decide(calm.with(\.lowPower, true), .default) == .pause(.lowPower))
    }

    @Test func sleepingOrLockedAlwaysPauses() {
        let s = Settings.default.with(\.pauseWhenCovered, false)
        #expect(PlaybackPolicy.decide(calm.with(\.screensAsleep, true), s) == .pause(.asleep))
        #expect(PlaybackPolicy.decide(calm.with(\.sessionActive, false), s) == .pause(.asleep))
    }

    @Test func userPauseWinsOverEverything() {
        let s = Settings.default.with(\.userPaused, true)
        #expect(PlaybackPolicy.decide(calm, s) == .pause(.user))
    }

    @Test func aHotMacSlowsDownThenStops() {
        #expect(PlaybackPolicy.decide(calm.with(\.thermal, .serious), .default) == .play(fps: 15))
        #expect(PlaybackPolicy.decide(calm.with(\.thermal, .critical), .default) == .pause(.hot))
        #expect(PlaybackPolicy.decide(calm.with(\.thermal, .fair), .default) == .play(fps: 30))
    }

    @Test func rendersAtOneXWhenSavingPower() {
        #expect(PlaybackPolicy.renderScale(calm, .default) == 2)
        #expect(PlaybackPolicy.renderScale(calm.with(\.onBattery, true), .default) == 1)
        #expect(PlaybackPolicy.renderScale(calm.with(\.lowPower, true), .default) == 1)
        #expect(PlaybackPolicy.renderScale(calm.with(\.thermal, .serious), .default) == 1)
        #expect(PlaybackPolicy.renderScale(calm.with(\.onBattery, true), Settings.default.with(\.sharpOnBattery, true)) == 2)
    }

    @Test func fpsIsClampedToSomethingSane() {
        #expect(PlaybackPolicy.decide(calm, Settings.default.with(\.fpsCap, 500)) == .play(fps: 120))
        #expect(PlaybackPolicy.decide(calm, Settings.default.with(\.fpsCap, 0)) == .play(fps: 1))
    }
}

@Suite struct RotationTests {
    @Test func movesToTheNextAndWraps() {
        #expect(Rotation.next(after: "a", in: ["a", "b", "c"]) == "b")
        #expect(Rotation.next(after: "c", in: ["a", "b", "c"]) == "a")
    }

    @Test func unknownCurrentStartsAtTheTop() {
        #expect(Rotation.next(after: "zzz", in: ["a", "b"]) == "a")
    }

    @Test func emptyListHasNothingNext() {
        #expect(Rotation.next(after: "a", in: []) == nil)
    }
}
