import Foundation

public enum ImportError: Error, Equatable, CustomStringConvertible {
    case unsupported(String)
    case badTemplate
    case builtIn

    public var description: String {
        switch self {
        case let .unsupported(ext): "Tokonoma can't play .\(ext) files. Try mp4, mov, webm, gif, png, jpg or webp."
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
    static let imageTypes: Set<String> = ["gif", "png", "jpg", "jpeg", "webp", "heic"]
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

    public static func importMedia(from source: URL, into root: URL, template: String) throws -> Wallpaper {
        let ext = source.pathExtension.lowercased()
        guard let kind = kind(of: source) else { throw ImportError.unsupported(ext) }
        guard template.contains(marker) else { throw ImportError.badTemplate }

        let fm = FileManager.default
        let taken = Set((try? fm.contentsOfDirectory(atPath: root.path)) ?? [])
        let id = slug(for: source.lastPathComponent, taken: taken)
        let folder = root.appendingPathComponent(id)
        let mediaName = "media.\(ext)"
        let manifest = Manifest(
            id: id,
            name: (source.lastPathComponent as NSString).deletingPathExtension,
            description: kind == .video ? "Imported video" : "Imported image",
            media: mediaName,
            properties: properties(for: kind)
        )

        // Not intermediate: if the folder somehow exists, fail rather than write into it.
        try fm.createDirectory(at: folder, withIntermediateDirectories: false)
        do {
            try fm.copyItem(at: source, to: folder.appendingPathComponent(mediaName))
            let html = template.replacingOccurrences(of: marker, with: #"data-media="\#(mediaName)""#)
            try Data(html.utf8).write(to: folder.appendingPathComponent("index.html"))
            try manifest.encoded().write(to: folder.appendingPathComponent(WallpaperLibrary.manifestName))
        } catch {
            // Only ever removes the folder this call just created.
            try? fm.removeItem(at: folder)
            throw error
        }
        return Wallpaper(manifest: manifest, folder: folder, isBuiltIn: false)
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
/// folder, replacing older copies and leaving imported ones alone.
public enum BundleSync {
    static let skipped: Set<String> = ["_sample"]

    @discardableResult
    public static func install(from bundled: URL, into root: URL) throws -> [String] {
        let fm = FileManager.default
        try fm.createDirectory(at: root, withIntermediateDirectories: true)
        let folders = try fm.contentsOfDirectory(at: bundled, includingPropertiesForKeys: [.isDirectoryKey])
            .filter { (try? $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true }
            .filter { !skipped.contains($0.lastPathComponent) && !$0.lastPathComponent.hasPrefix(".") }
        var ids: [String] = []
        for folder in folders {
            let target = root.appendingPathComponent(folder.lastPathComponent)
            if fm.fileExists(atPath: target.path) { try fm.removeItem(at: target) }
            try fm.copyItem(at: folder, to: target)
            if fm.fileExists(atPath: folder.appendingPathComponent(WallpaperLibrary.manifestName).path) {
                ids.append(folder.lastPathComponent)
            }
        }
        return ids.sorted()
    }
}
