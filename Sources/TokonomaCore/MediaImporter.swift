import Foundation

public enum ImportError: Error, Equatable, CustomStringConvertible {
    case unsupported(String)
    case badTemplate
    case builtIn

    public var description: String {
        switch self {
        case let .unsupported(ext): "Tokonoma can't play .\(ext) files. Try a video (mp4, mov, webm) or a picture (gif, png, jpg, webp, heic, avif, tiff…)."
        case .badTemplate: "The media template is damaged. Reinstalling Tokonoma will put it back."
        case .builtIn: "Built-in wallpapers can't be removed."
        }
    }
}

/// Turns a video or picture from anywhere on disk into a wallpaper folder:
///   <root>/<slug>/media.<ext>, index.html, wallpaper.json
public enum MediaImporter {
    public enum Kind: Equatable, Sendable { case video, image }

    static let videoTypes: Set<String> = ["mp4", "m4v", "mov", "webm"]
    /// Anything ImageIO reads. Animated ones become clips, odd stills become JPEG/PNG (see MediaPrep).
    static let imageTypes: Set<String> = [
        "gif", "png", "apng", "jpg", "jpeg", "jpe", "webp", "heic", "heif", "heics", "avif",
        "tif", "tiff", "bmp", "jp2", "psd", "tga", "ico", "dng",
    ]
    static let marker = #"data-media="""#

    public static var acceptedExtensions: [String] { (videoTypes.union(imageTypes)).sorted() }

    public static func kind(of url: URL) -> Kind? {
        let ext = url.pathExtension.lowercased()
        if videoTypes.contains(ext) { return .video }
        if imageTypes.contains(ext) { return .image }
        return nil
    }

    public static func slug(for filename: String, taken: Set<String>) -> String {
        let stem = (filename as NSString).deletingPathExtension.lowercased()
        let words = stem.split { !($0.isASCII && ($0.isLetter || $0.isNumber)) }
        let base = words.isEmpty ? "media" : words.joined(separator: "-")
        // APFS is case-insensitive by default: "Aurora" and "aurora" are one folder.
        let used = Set(taken.map { $0.lowercased() })
        guard used.contains(base) else { return base }
        var n = 2
        while used.contains("\(base)-\(n)") { n += 1 }
        return "\(base)-\(n)"
    }

    public static func importMedia(from source: URL, into root: URL, template: String) async throws -> Wallpaper {
        let ext = source.pathExtension.lowercased()
        guard let picked = kind(of: source) else { throw ImportError.unsupported(ext) }
        guard template.contains(marker) else { throw ImportError.badTemplate }

        let fm = FileManager.default
        let taken = Set((try? fm.contentsOfDirectory(atPath: root.path)) ?? [])
        let id = slug(for: source.lastPathComponent, taken: taken)
        let folder = root.appendingPathComponent(id)

        // Not intermediate: if the folder somehow exists, fail rather than write into it.
        try fm.createDirectory(at: folder, withIntermediateDirectories: false)
        do {
            var mediaName = "media.\(ext)"
            var playsAs = picked
            if picked == .video {
                try fm.copyItem(at: source, to: folder.appendingPathComponent(mediaName))
            } else {
                let prepared = try await MediaPrep.picture(source, into: folder)
                mediaName = prepared.fileName
                if prepared.animated { playsAs = .video }
            }
            let manifest = Manifest(
                id: id,
                name: (source.lastPathComponent as NSString).deletingPathExtension,
                description: description(original: picked, playsAs: playsAs, ext: ext),
                media: mediaName,
                properties: properties(for: playsAs)
            )
            let html = template.replacingOccurrences(of: marker, with: #"data-media="\#(mediaName)""#)
            try Data(html.utf8).write(to: folder.appendingPathComponent("index.html"))
            try manifest.encoded().write(to: folder.appendingPathComponent(WallpaperLibrary.manifestName))
            return Wallpaper(manifest: manifest, folder: folder, isBuiltIn: false)
        } catch {
            // Only ever removes the folder this call just created.
            try? fm.removeItem(at: folder)
            throw error
        }
    }

    static func description(original: Kind, playsAs: Kind, ext: String) -> String {
        switch (original, playsAs) {
        case (.video, _): "Imported video"
        case (.image, .video): "Imported animation (\(ext))"
        case (.image, .image): "Imported picture"
        }
    }

    public static func remove(_ wallpaper: Wallpaper) throws {
        guard !wallpaper.isBuiltIn else { throw ImportError.builtIn }
        try FileManager.default.removeItem(at: wallpaper.folder)
    }

    static func properties(for kind: Kind) -> [PropertySpec] {
        var specs: [PropertySpec] = [
            PropertySpec(key: "mode", label: "weave", kind: .choice, options: ["glyph", "block", "dot", "raw"], defaultValue: .text("glyph")),
            PropertySpec(key: "ramp", label: "glyphs", kind: .choice, options: ["lines", "ascii", "kana", "dense"], defaultValue: .text("lines")),
            PropertySpec(key: "cell", label: "cell size", kind: .range, min: 3, max: 24, step: 1, defaultValue: .number(8)),
            PropertySpec(key: "fit", label: "fit", kind: .choice, options: ["cover", "contain"], defaultValue: .text("cover")),
            PropertySpec(key: "contrast", label: "contrast", kind: .range, min: 0.5, max: 2, step: 0.05, defaultValue: .number(1.1)),
            PropertySpec(key: "saturation", label: "colour", kind: .range, min: 0, max: 2.5, step: 0.05, defaultValue: .number(1.2)),
            PropertySpec(key: "brightness", label: "brightness", kind: .range, min: 0.4, max: 2, step: 0.05, defaultValue: .number(1)),
        ]
        if kind == .video {
            specs.append(PropertySpec(key: "speed", label: "speed", kind: .range, min: 0.25, max: 3, step: 0.05, defaultValue: .number(1)))
        }
        return specs
    }
}

/// Copies the wallpapers that ship inside the app into the user's library
/// folder, replacing older copies and leaving imported ones alone. Each folder
/// lands beside its target first and is swapped in, so a failure halfway
/// never leaves a scene missing, and one bad folder doesn't stop the rest.
public enum BundleSync {
    static let skipped: Set<String> = ["_sample"]

    public struct Installation: Equatable, Sendable {
        public let ids: [String]
        public let failures: [String: String]
    }

    /// Which wallpapers ship with the app, read from the bundle itself.
    public static func builtInIDs(in bundled: URL) -> [String] {
        folders(in: bundled)
            .filter { FileManager.default.fileExists(atPath: $0.appendingPathComponent(WallpaperLibrary.manifestName).path) }
            .map(\.lastPathComponent)
            .sorted()
    }

    @discardableResult
    public static func install(from bundled: URL, into root: URL) throws -> Installation {
        let fm = FileManager.default
        try fm.createDirectory(at: root, withIntermediateDirectories: true)
        var failures: [String: String] = [:]
        for folder in folders(in: bundled) {
            let name = folder.lastPathComponent
            let target = root.appendingPathComponent(name)
            let incoming = root.appendingPathComponent(".\(name).incoming")
            do {
                try? fm.removeItem(at: incoming)
                try fm.copyItem(at: folder, to: incoming)
                if fm.fileExists(atPath: target.path) {
                    _ = try fm.replaceItemAt(target, withItemAt: incoming)
                } else {
                    try fm.moveItem(at: incoming, to: target)
                }
            } catch {
                try? fm.removeItem(at: incoming)
                failures[name] = error.localizedDescription
            }
        }
        let ids = builtInIDs(in: bundled).filter { failures[$0] == nil }
        return Installation(ids: ids, failures: failures)
    }

    private static func folders(in bundled: URL) -> [URL] {
        ((try? FileManager.default.contentsOfDirectory(at: bundled, includingPropertiesForKeys: [.isDirectoryKey])) ?? [])
            .filter { (try? $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true }
            .filter { !skipped.contains($0.lastPathComponent) && !$0.lastPathComponent.hasPrefix(".") }
    }
}
