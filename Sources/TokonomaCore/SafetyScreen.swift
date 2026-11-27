import AVFoundation
import CoreGraphics
import CoreML
import Foundation
import ImageIO
import Vision

public enum SafetyError: Error, Equatable, CustomStringConvertible {
    case modelMissing(String)
    case unreadable(String)

    public var description: String {
        switch self {
        case let .modelMissing(why): "The safety screen couldn't load (\(why)), so nothing was installed."
        case let .unreadable(name): "\(name) couldn't be opened for the safety screen."
        }
    }
}

/// What the screen saw: the worst nudity score over every frame it looked at.
/// Judged by validate.js `judgeScreen`, so the threshold lives in rules.js.
public struct SafetyVerdict: Codable, Equatable, Sendable {
    public let nsfw: Double
    public let frames: Int

    public init(nsfw: Double, frames: Int) {
        self.nsfw = nsfw
        self.frames = frames
    }

    public func merged(_ other: SafetyVerdict) -> SafetyVerdict {
        SafetyVerdict(nsfw: max(nsfw, other.nsfw), frames: frames + other.frames)
    }

    public static let empty = SafetyVerdict(nsfw: 0, frames: 0)
}

/// On-device nudity screen for every wallpaper package installed into the
/// app. A 17 KB Create ML classifier (NSFWDetector by LOVOO, BSD-3)
/// on top of Apple's built-in Vision feature print; no image leaves the Mac.
public final class SafetyScreen: @unchecked Sendable {
    private let model: VNCoreMLModel
    /// Clips are sampled twice a second (at least 10 frames, at most 120 for
    /// a full minute), so nothing explicit can hide between samples for long.
    public static let clipSamples = 10
    public static let samplesPerSecond = 2.0
    public static let maxSamples = 120

    static func sampleCount(seconds: Double) -> Int {
        min(maxSamples, max(clipSamples, Int((seconds * samplesPerSecond).rounded(.up))))
    }

    public init(compiledModel: URL) throws {
        do {
            let config = MLModelConfiguration()
            config.computeUnits = .cpuAndNeuralEngine
            model = try VNCoreMLModel(for: MLModel(contentsOf: compiledModel, configuration: config))
        } catch {
            throw SafetyError.modelMissing(error.localizedDescription)
        }
    }

    /// Uses a compiled .mlmodelc if there is one, otherwise compiles the
    /// .mlmodel once into `cache` (the app bundle ships it compiled).
    public static func load(model: URL, cache: URL) async throws -> SafetyScreen {
        if model.pathExtension == "mlmodelc" { return try SafetyScreen(compiledModel: model) }
        let compiled = cache.appendingPathComponent(model.deletingPathExtension().lastPathComponent + ".mlmodelc")
        if !FileManager.default.fileExists(atPath: compiled.path) {
            do {
                let temp = try await MLModel.compileModel(at: model)
                try FileManager.default.createDirectory(at: cache, withIntermediateDirectories: true)
                try? FileManager.default.removeItem(at: compiled)
                try FileManager.default.moveItem(at: temp, to: compiled)
            } catch {
                throw SafetyError.modelMissing(error.localizedDescription)
            }
        }
        return try SafetyScreen(compiledModel: compiled)
    }

    /// Probability (0–1) that one picture shows nudity.
    public func score(_ image: CGImage) throws -> Double {
        let request = VNCoreMLRequest(model: model)
        request.imageCropAndScaleOption = .scaleFit
        try VNImageRequestHandler(cgImage: image).perform([request])
        let labels = (request.results as? [VNClassificationObservation]) ?? []
        return Double(labels.first { $0.identifier.uppercased() == "NSFW" }?.confidence ?? 0)
    }

    public func screen(images: [CGImage]) throws -> SafetyVerdict {
        try images.reduce(.empty) { verdict, image in verdict.merged(SafetyVerdict(nsfw: try score(image), frames: 1)) }
    }

    /// Every frame of a picture (all of them for short animations, a spread otherwise).
    public func screen(picture data: Data, name: String) throws -> SafetyVerdict {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil), CGImageSourceGetCount(source) > 0 else {
            throw SafetyError.unreadable(name)
        }
        let count = CGImageSourceGetCount(source)
        let wanted = min(count, Self.maxSamples)
        let picks = Set((0..<wanted).map { $0 * count / wanted })
        let frames = picks.sorted().compactMap { MediaPrep.frame(source, at: $0, maxSide: 512) }
        guard !frames.isEmpty else { throw SafetyError.unreadable(name) }
        return try screen(images: frames)
    }

    /// Frames spread over a clip's whole length.
    public func screen(clip url: URL) async throws -> SafetyVerdict {
        let asset = AVURLAsset(url: url)
        let seconds = (try? await asset.load(.duration).seconds) ?? 0
        guard seconds.isFinite, seconds > 0 else { throw SafetyError.unreadable(url.lastPathComponent) }
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 512, height: 512)
        generator.requestedTimeToleranceBefore = CMTime(seconds: 0.1, preferredTimescale: 600)
        generator.requestedTimeToleranceAfter = CMTime(seconds: 0.1, preferredTimescale: 600)
        let samples = Self.sampleCount(seconds: seconds)
        var frames: [CGImage] = []
        for i in 0..<samples {
            let at = seconds * (Double(i) + 0.5) / Double(samples)
            if let (image, _) = try? await generator.image(at: CMTime(seconds: at, preferredTimescale: 600)) {
                frames.append(image)
            }
        }
        guard !frames.isEmpty else { throw SafetyError.unreadable(url.lastPathComponent) }
        return try screen(images: frames)
    }

    /// A package's media and images, from memory. Clips go through a temp file
    /// because AVFoundation reads from disk.
    public func screen(package: CommunityPackage) async throws -> SafetyVerdict {
        var verdict = SafetyVerdict.empty
        for (path, data) in package.files.sorted(by: { $0.key < $1.key }) {
            let ext = (path as NSString).pathExtension.lowercased()
            if ext == "mp4" {
                let temp = FileManager.default.temporaryDirectory.appendingPathComponent("tokonoma-screen-\(UUID().uuidString).mp4")
                try data.write(to: temp)
                defer { try? FileManager.default.removeItem(at: temp) }
                verdict = verdict.merged(try await screen(clip: temp))
            } else if ["png", "jpg", "jpeg", "webp"].contains(ext) {
                verdict = verdict.merged(try screen(picture: data, name: path))
            }
        }
        return verdict
    }
}
