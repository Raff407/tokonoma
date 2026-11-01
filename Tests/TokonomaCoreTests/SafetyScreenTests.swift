import CoreGraphics
import Foundation
import Testing
@testable import TokonomaCore

private let modelURL = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    .appendingPathComponent("Resources/Models/NSFW.mlmodel")

private func screen() async throws -> SafetyScreen {
    try await SafetyScreen.load(model: modelURL, cache: try makeTempDir())
}

/// A calm still: indigo sky over a dark ground, like the official scenes.
private func landscape(width: Int = 320, height: Int = 200) throws -> CGImage {
    let context = try #require(CGContext(
        data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ))
    context.setFillColor(CGColor(red: 0.12, green: 0.16, blue: 0.3, alpha: 1))
    context.fill(CGRect(x: 0, y: height / 3, width: width, height: height))
    context.setFillColor(CGColor(red: 0.08, green: 0.08, blue: 0.07, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height / 3))
    return try #require(context.makeImage())
}

@Suite struct SafetyScreenTests {
    @Test func calmScenesPassTheScreen() async throws {
        let screen = try await screen()
        let score = try screen.score(try landscape())
        #expect(score >= 0 && score < 0.7)
    }

    @Test func longerClipsGetDenserSampling() {
        #expect(SafetyScreen.sampleCount(seconds: 1) == 10)
        #expect(SafetyScreen.sampleCount(seconds: 30) == 60)
        #expect(SafetyScreen.sampleCount(seconds: 60) == 120)
        #expect(SafetyScreen.sampleCount(seconds: 600) == 120)
    }

    @Test func verdictsKeepTheWorstFrame() {
        let merged = SafetyVerdict(nsfw: 0.1, frames: 2).merged(SafetyVerdict(nsfw: 0.8, frames: 3))
        #expect(merged == SafetyVerdict(nsfw: 0.8, frames: 5))
    }

    @Test func clipsAreSampledAcrossTheirLength() async throws {
        let screen = try await screen()
        let folder = try makeTempDir()
        let gif = folder.appendingPathComponent("loop.gif")
        try writeImage(gif, type: .gif, frames: 12, width: 160, height: 100)
        let prepared = try await MediaPrep.picture(gif, into: folder)
        let verdict = try await screen.screen(clip: folder.appendingPathComponent(prepared.fileName))
        #expect(verdict.frames == SafetyScreen.clipSamples)
        #expect(verdict.nsfw < 0.7)
    }

    @Test func picturesAreScreenedFromMemory() async throws {
        let screen = try await screen()
        let folder = try makeTempDir()
        let file = folder.appendingPathComponent("still.png")
        try writeImage(file, type: .png, frames: 1)
        let verdict = try screen.screen(picture: Data(contentsOf: file), name: "still.png")
        #expect(verdict.frames == 1)
        #expect(throws: SafetyError.unreadable("junk.png")) { try screen.screen(picture: Data([1, 2]), name: "junk.png") }
    }

    @Test func aMissingModelFailsClosed() async throws {
        await #expect(throws: SafetyError.self) {
            try await SafetyScreen.load(model: URL(fileURLWithPath: "/nowhere/NSFW.mlmodel"), cache: try makeTempDir())
        }
    }
}
