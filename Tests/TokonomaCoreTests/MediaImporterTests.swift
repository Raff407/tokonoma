import AVFoundation
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Testing
@testable import TokonomaCore

private let template = """
<!doctype html><body data-media=""><script src="../_lib/media.js"></script></body>
"""

@Suite struct MediaImporterTests {
    @Test func slugsAreFolderSafeAndUnique() {
        #expect(MediaImporter.slug(for: "Rainy Street (4K).mp4", taken: []) == "rainy-street-4k")
        #expect(MediaImporter.slug(for: "rainy street.mov", taken: ["rainy-street"]) == "rainy-street-2")
        #expect(MediaImporter.slug(for: "rainy street.mov", taken: ["rainy-street", "rainy-street-2"]) == "rainy-street-3")
        #expect(MediaImporter.slug(for: "_hidden.png", taken: []) == "hidden")
        #expect(MediaImporter.slug(for: "....gif", taken: []) == "media")
        #expect(MediaImporter.slug(for: "夜桜.mp4", taken: []) == "media")
    }

    @Test func slugsIgnoreCaseLikeTheDiskDoes() {
        #expect(MediaImporter.slug(for: "aurora.mp4", taken: ["Aurora"]) == "aurora-2")
    }

    @Test func importNeverTouchesAFolderThatDiffersOnlyByCase() async throws {
        let root = try makeTempDir()
        try writeWallpaper(root, id: "Aurora", json: #"{"id":"Aurora","name":"Mine","entry":"index.html"}"#)
        let source = try makeTempDir().appendingPathComponent("aurora.mp4")
        try Data([1]).write(to: source)

        let imported = try await MediaImporter.importMedia(from: source, into: root, template: template)

        #expect(imported.id == "aurora-2")
        let original = try String(contentsOf: root.appendingPathComponent("Aurora/wallpaper.json"), encoding: .utf8)
        #expect(original.contains(#""name":"Mine""#))
    }

    @Test func acceptsCommonFormatsOnly() {
        #expect(MediaImporter.kind(of: URL(fileURLWithPath: "/a/b.MP4")) == .video)
        #expect(MediaImporter.kind(of: URL(fileURLWithPath: "/a/b.gif")) == .image)
        #expect(MediaImporter.kind(of: URL(fileURLWithPath: "/a/b.exe")) == nil)
        for ext in ["heic", "avif", "tiff", "bmp", "apng"] {
            #expect(MediaImporter.kind(of: URL(fileURLWithPath: "/a/b.\(ext)")) == .image)
        }
    }

    @Test func animatedGifsBecomeALoopingClip() async throws {
        let root = try makeTempDir()
        let source = try makeTempDir().appendingPathComponent("rain.gif")
        try writeImage(source, type: .gif, frames: 6)

        let wallpaper = try await MediaImporter.importMedia(from: source, into: root, template: template)

        #expect(wallpaper.manifest.media == "media.mp4")
        #expect(wallpaper.manifest.spec(for: "speed") != nil)
        let clip = AVURLAsset(url: wallpaper.folder.appendingPathComponent("media.mp4"))
        let duration = try await clip.load(.duration).seconds
        #expect(abs(duration - 0.6) < 0.05)
        let html = try String(contentsOf: wallpaper.folder.appendingPathComponent("index.html"), encoding: .utf8)
        #expect(html.contains(#"data-media="media.mp4""#))
    }

    @Test func oneFrameGifsStayPictures() async throws {
        let root = try makeTempDir()
        let source = try makeTempDir().appendingPathComponent("dot.gif")
        try writeImage(source, type: .gif, frames: 1)
        let wallpaper = try await MediaImporter.importMedia(from: source, into: root, template: template)
        #expect(wallpaper.manifest.media == "media.jpg")
        #expect(wallpaper.manifest.spec(for: "speed") == nil)
    }

    @Test func stillsWebKitCantDrawAreConverted() async throws {
        let root = try makeTempDir()
        let source = try makeTempDir().appendingPathComponent("scan.tiff")
        try writeImage(source, type: .tiff, frames: 1)
        let wallpaper = try await MediaImporter.importMedia(from: source, into: root, template: template)
        #expect(wallpaper.manifest.media == "media.jpg")
        #expect(MediaPrep.frameCount(of: wallpaper.folder.appendingPathComponent("media.jpg")) == 1)
    }

    @Test func unreadablePicturesLeaveNothingBehind() async throws {
        let root = try makeTempDir()
        let source = try makeTempDir().appendingPathComponent("broken.png")
        try Data([0, 1, 2]).write(to: source)
        await #expect(throws: MediaPrepError.unreadable("broken.png")) {
            try await MediaImporter.importMedia(from: source, into: root, template: template)
        }
        #expect((try? FileManager.default.contentsOfDirectory(atPath: root.path))?.isEmpty == true)
    }

    @Test func importBuildsACompleteWallpaperFolder() async throws {
        let root = try makeTempDir()
        let source = try makeTempDir().appendingPathComponent("Night Walk.mp4")
        try Data([0, 1, 2, 3]).write(to: source)

        let wallpaper = try await MediaImporter.importMedia(from: source, into: root, template: template)

        #expect(wallpaper.id == "night-walk")
        #expect(wallpaper.name == "Night Walk")
        #expect(wallpaper.manifest.media == "media.mp4")
        let folder = root.appendingPathComponent("night-walk")
        let html = try String(contentsOf: folder.appendingPathComponent("index.html"), encoding: .utf8)
        #expect(html.contains(#"data-media="media.mp4""#))
        #expect(FileManager.default.fileExists(atPath: folder.appendingPathComponent("media.mp4").path))
        let rescanned = WallpaperLibrary.scan(root, builtIn: [])
        #expect(rescanned.wallpapers.map(\.id) == ["night-walk"])
        #expect(rescanned.wallpapers.first?.manifest.spec(for: "speed") != nil)
    }

    @Test func imagesDoNotGetAPlaybackSpeed() async throws {
        let root = try makeTempDir()
        let source = try makeTempDir().appendingPathComponent("still.png")
        try writeImage(source, type: .png, frames: 1)
        let wallpaper = try await MediaImporter.importMedia(from: source, into: root, template: template)
        #expect(wallpaper.manifest.spec(for: "speed") == nil)
    }

    @Test func rejectsUnsupportedFiles() async throws {
        let root = try makeTempDir()
        let source = try makeTempDir().appendingPathComponent("notes.txt")
        try Data([0]).write(to: source)
        await #expect(throws: ImportError.unsupported("txt")) {
            try await MediaImporter.importMedia(from: source, into: root, template: template)
        }
    }

    @Test func aBrokenTemplateLeavesNothingBehind() async throws {
        let root = try makeTempDir()
        let source = try makeTempDir().appendingPathComponent("clip.mp4")
        try Data([0]).write(to: source)
        await #expect(throws: ImportError.badTemplate) {
            try await MediaImporter.importMedia(from: source, into: root, template: "<html></html>")
        }
        #expect((try? FileManager.default.contentsOfDirectory(atPath: root.path))?.isEmpty == true)
    }

    @Test func removeRefusesBuiltIns() throws {
        let root = try makeTempDir()
        try writeWallpaper(root, id: "torii")
        let builtIn = try #require(WallpaperLibrary.scan(root, builtIn: ["torii"]).wallpapers.first)
        #expect(throws: ImportError.builtIn) { try MediaImporter.remove(builtIn) }
        #expect(FileManager.default.fileExists(atPath: builtIn.folder.path))
    }
}

@Suite struct BundleSyncTests {
    @Test func copiesBundledFoldersAndKeepsUserOnes() throws {
        let bundled = try makeTempDir()
        let root = try makeTempDir()
        try writeWallpaper(bundled, id: "torii")
        try FileManager.default.createDirectory(at: bundled.appendingPathComponent("_lib"), withIntermediateDirectories: true)
        try Data("v2".utf8).write(to: bundled.appendingPathComponent("_lib/kasuri.js"))
        try writeWallpaper(root, id: "my-clip")
        try FileManager.default.createDirectory(at: root.appendingPathComponent("_lib"), withIntermediateDirectories: true)
        try Data("v1".utf8).write(to: root.appendingPathComponent("_lib/kasuri.js"))

        let result = try BundleSync.install(from: bundled, into: root)

        #expect(result.ids == ["torii"])
        #expect(result.failures.isEmpty)
        let lib = try String(contentsOf: root.appendingPathComponent("_lib/kasuri.js"), encoding: .utf8)
        #expect(lib == "v2")
        #expect(FileManager.default.fileExists(atPath: root.appendingPathComponent("my-clip/wallpaper.json").path))
        #expect(FileManager.default.fileExists(atPath: root.appendingPathComponent("torii/index.html").path))
    }

    @Test func removesRetiredBuiltInsButNeverSomeoneElsesWallpaper() throws {
        let bundled = try makeTempDir()
        let root = try makeTempDir()
        try writeWallpaper(bundled, id: "torii")
        let fm = FileManager.default
        // A retired scene as an older build left it.
        try writeWallpaper(root, id: "sumi")
        try Data("//".utf8).write(to: root.appendingPathComponent("sumi/scene.js"))
        // Same id, but installed from the market.
        try writeWallpaper(root, id: "niwa")
        try Data("//".utf8).write(to: root.appendingPathComponent("niwa/scene.js"))
        try Data("{}".utf8).write(to: root.appendingPathComponent("niwa/.origin.json"))

        try BundleSync.install(from: bundled, into: root)

        #expect(!fm.fileExists(atPath: root.appendingPathComponent("sumi").path))
        #expect(fm.fileExists(atPath: root.appendingPathComponent("niwa/scene.js").path))
    }

    @Test func builtInIDsComeFromTheBundleEvenIfInstallFails() throws {
        let bundled = try makeTempDir()
        try writeWallpaper(bundled, id: "koi")
        try writeWallpaper(bundled, id: "torii")
        #expect(BundleSync.builtInIDs(in: bundled) == ["koi", "torii"])
    }

    @Test func skipsScratchFolders() throws {
        let bundled = try makeTempDir()
        let root = try makeTempDir()
        try FileManager.default.createDirectory(at: bundled.appendingPathComponent("_sample"), withIntermediateDirectories: true)
        _ = try BundleSync.install(from: bundled, into: root)
        #expect(!FileManager.default.fileExists(atPath: root.appendingPathComponent("_sample").path))
    }
}

/// A small test picture: `frames` solid frames 100 ms apart, each a different grey.
func writeImage(_ url: URL, type: UTType, frames: Int, width: Int = 64, height: Int = 40) throws {
    let dest = try #require(CGImageDestinationCreateWithURL(url as CFURL, type.identifier as CFString, frames, nil))
    for i in 0..<frames {
        let context = try #require(CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        ))
        context.setFillColor(CGColor(gray: Double(i + 1) / Double(frames + 1), alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        let props = [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: 0.1]] as CFDictionary
        CGImageDestinationAddImage(dest, try #require(context.makeImage()), props)
    }
    #expect(CGImageDestinationFinalize(dest))
}
