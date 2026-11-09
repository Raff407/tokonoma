import Testing
@testable import TokonomaCore

/// The poster is what a clip's thumbnail and market preview are woven from,
/// so it has to show the clip, not its first empty moment.
struct PosterFrameTests {
    @Test func takesTheMiddleOfAClip() {
        #expect(MediaPrep.posterSeconds(duration: 4) == 2)
        #expect(MediaPrep.posterSeconds(duration: 60) == 30)
    }

    @Test func aMissingOrBrokenLengthFallsBackToTheStart() {
        #expect(MediaPrep.posterSeconds(duration: 0) == 0)
        #expect(MediaPrep.posterSeconds(duration: -1) == 0)
        #expect(MediaPrep.posterSeconds(duration: .nan) == 0)
        #expect(MediaPrep.posterSeconds(duration: .infinity) == 0)
    }
}
