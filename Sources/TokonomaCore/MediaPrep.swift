import AVFoundation
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

public enum MediaPrepError: Error, Equatable, CustomStringConvertible {
    case unreadable(String)
    case encodeFailed(String)

    public var description: String {
        switch self {
        case let .unreadable(name): "\(name) couldn't be read as a picture."
        case let .encodeFailed(why): "The animation couldn't be turned into a clip (\(why))."
        }
    }
}

/// Puts imported media into a form WebKit plays well.
///
/// WebKit only advances an animated gif while the <img> is on screen, and the
/// wallpaper page draws it into a canvas from off screen, so it froze on the
/// first frame. Every animated picture (gif, apng, animated webp, heics) is
/// turned into a short H.264 clip instead, which plays and loops like any
/// video. Stills WebKit can't show (tiff, bmp, heic, psd…) become a JPEG/PNG.
public enum MediaPrep {
    /// Stills WebKit draws natively; anything else is converted.
    static let webStills: Set<String> = ["png", "jpg", "jpeg", "webp"]
    /// Woven wallpapers don't need more than this; it keeps clips light.
    public static let maxClipSide = 1920
    public static let maxStillSide = 3840
    static let maxFrames = 1800

    public struct Prepared: Equatable, Sendable {
        public let fileName: String
        public let animated: Bool
    }

    /// How many frames a picture has (1 for stills). nil if ImageIO can't read it.
    public static func frameCount(of url: URL) -> Int? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let count = CGImageSourceGetCount(source)
        return count > 0 ? count : nil
    }

    /// Writes the playable copy of a picture into `folder` and names it.
    public static func picture(_ url: URL, into folder: URL) async throws -> Prepared {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil), CGImageSourceGetCount(source) > 0 else {
            throw MediaPrepError.unreadable(url.lastPathComponent)
        }
        if CGImageSourceGetCount(source) > 1 {
            let target = folder.appendingPathComponent("media.mp4")
            try await clip(from: source, to: target)
            return Prepared(fileName: target.lastPathComponent, animated: true)
        }
        let ext = url.pathExtension.lowercased()
        if webStills.contains(ext), let side = longestSide(source), side <= maxStillSide {
            let name = "media.\(ext)"
            try FileManager.default.copyItem(at: url, to: folder.appendingPathComponent(name))
            return Prepared(fileName: name, animated: false)
        }
        return Prepared(fileName: try still(from: source, into: folder, maxSide: maxStillSide), animated: false)
    }

    // MARK: - Stills

    /// Re-encodes one frame, upright and no bigger than `maxSide`. PNG when it
    /// has transparency, JPEG otherwise. Returns the file name it wrote.
    public static func still(from source: CGImageSource, into folder: URL, maxSide: Int, quality: Double = 0.9) throws -> String {
        guard let image = frame(source, at: 0, maxSide: maxSide) else { throw MediaPrepError.unreadable("frame") }
        let alpha = ![.none, .noneSkipFirst, .noneSkipLast].contains(image.alphaInfo)
        let type: UTType = alpha ? .png : .jpeg
        let name = alpha ? "media.png" : "media.jpg"
        let url = folder.appendingPathComponent(name)
        guard let dest = CGImageDestinationCreateWithURL(url as CFURL, type.identifier as CFString, 1, nil) else {
            throw MediaPrepError.encodeFailed("no image writer")
        }
        CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        guard CGImageDestinationFinalize(dest) else { throw MediaPrepError.encodeFailed("image write failed") }
        return name
    }

    static func longestSide(_ source: CGImageSource) -> Int? {
        guard let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let w = props[kCGImagePropertyPixelWidth] as? Int, let h = props[kCGImagePropertyPixelHeight] as? Int
        else { return nil }
        return max(w, h)
    }

    /// One decoded frame, rotated upright and scaled down to fit `maxSide`.
    static func frame(_ source: CGImageSource, at index: Int, maxSide: Int) -> CGImage? {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxSide,
            kCGImageSourceShouldCacheImmediately: true,
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, index, options as CFDictionary)
    }

    // MARK: - Animations

    /// Seconds frame `index` stays up, the way browsers read it: anything
    /// under 20 ms means "as fast as you like" and is shown for 100 ms.
    static func delay(_ source: CGImageSource, at index: Int) -> Double {
        let props = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any] ?? [:]
        let families: [(CFString, CFString, CFString)] = [
            (kCGImagePropertyGIFDictionary, kCGImagePropertyGIFUnclampedDelayTime, kCGImagePropertyGIFDelayTime),
            (kCGImagePropertyPNGDictionary, kCGImagePropertyAPNGUnclampedDelayTime, kCGImagePropertyAPNGDelayTime),
            (kCGImagePropertyWebPDictionary, kCGImagePropertyWebPUnclampedDelayTime, kCGImagePropertyWebPDelayTime),
            (kCGImagePropertyHEICSDictionary, kCGImagePropertyHEICSUnclampedDelayTime, kCGImagePropertyHEICSDelayTime),
        ]
        for (dictKey, unclamped, clamped) in families {
            guard let dict = props[dictKey] as? [CFString: Any] else { continue }
            let value = (dict[unclamped] as? Double) ?? (dict[clamped] as? Double) ?? 0
            return value < 0.02 ? 0.1 : value
        }
        return 0.1
    }

    static func evenSize(_ image: CGImage) -> (Int, Int) {
        (max(2, image.width & ~1), max(2, image.height & ~1))
    }

    /// Every frame of an animated picture, at its own timing, into an H.264 clip.
    static func clip(from source: CGImageSource, to url: URL) async throws {
        guard let first = frame(source, at: 0, maxSide: maxClipSide) else { throw MediaPrepError.unreadable("first frame") }
        let (width, height) = evenSize(first)
        let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: max(400_000, width * height * 3)],
        ])
        input.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height,
        ])
        guard writer.canAdd(input) else { throw MediaPrepError.encodeFailed("writer refused the track") }
        writer.add(input)
        guard writer.startWriting() else { throw MediaPrepError.encodeFailed(writer.error?.localizedDescription ?? "couldn't start") }
        writer.startSession(atSourceTime: .zero)

        var seconds = 0.0
        let count = min(CGImageSourceGetCount(source), maxFrames)
        for index in 0..<count {
            try Task.checkCancellation()
            guard let image = index == 0 ? first : frame(source, at: index, maxSide: maxClipSide) else { continue }
            while !input.isReadyForMoreMediaData { try await Task.sleep(for: .milliseconds(2)) }
            guard let pool = adaptor.pixelBufferPool, let buffer = draw(image, width: width, height: height, pool: pool) else {
                writer.cancelWriting()
                throw MediaPrepError.encodeFailed("no frame buffer")
            }
            guard adaptor.append(buffer, withPresentationTime: CMTime(seconds: seconds, preferredTimescale: 600)) else {
                writer.cancelWriting()
                throw MediaPrepError.encodeFailed(writer.error?.localizedDescription ?? "frame \(index) refused")
            }
            seconds += delay(source, at: index)
        }
        input.markAsFinished()
        // The last frame needs a length too, so the session ends after it.
        writer.endSession(atSourceTime: CMTime(seconds: seconds, preferredTimescale: 600))
        await writer.finishWriting()
        guard writer.status == .completed else {
            throw MediaPrepError.encodeFailed(writer.error?.localizedDescription ?? "unfinished clip")
        }
    }

    /// Paints a frame over black (gifs can be transparent; video can't), filling the buffer.
    static func draw(_ image: CGImage, width: Int, height: Int, pool: CVPixelBufferPool) -> CVPixelBuffer? {
        var out: CVPixelBuffer?
        guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &out) == kCVReturnSuccess, let buffer = out else { return nil }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let context = CGContext(
            data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height, bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        ) else { return nil }
        context.setFillColor(CGColor(gray: 0, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        return buffer
    }
}

extension MediaPrep {
    /// When to grab a clip's poster frame: the middle, where something is
    /// happening. The first moments are often empty (a lantern not yet in frame),
    /// and the poster is what the thumbnail and market preview are woven from.
    public static func posterSeconds(duration: Double) -> Double {
        guard duration.isFinite, duration > 0 else { return 0 }
        return duration / 2
    }
}
