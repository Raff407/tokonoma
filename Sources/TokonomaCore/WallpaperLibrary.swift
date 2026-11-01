import Foundation

/// A wallpaper found on disk: its manifest plus where it lives.
public struct Wallpaper: Identifiable, Equatable, Hashable, Sendable {
    public let manifest: Manifest
    public let folder: URL
    public let isBuiltIn: Bool
    /// Set for community wallpapers; nil for built-ins and your own imports.
    public let origin: Origin?

    public var id: String { manifest.id }
    public var name: String { manifest.name }
    public var entryURL: URL { folder.appendingPathComponent(manifest.entry) }
    public var isMedia: Bool { manifest.media != nil }
    public var isCommunity: Bool { origin?.source == .community }

    public init(manifest: Manifest, folder: URL, isBuiltIn: Bool, origin: Origin? = nil) {
        self.manifest = manifest
        self.folder = folder
        self.isBuiltIn = isBuiltIn
        self.origin = origin
    }
}

public struct LibraryProblem: Equatable, Sendable {
    public let folder: String
    public let reason: String
}

public struct LibraryScan: Equatable, Sendable {
    public let wallpapers: [Wallpaper]
    public let problems: [LibraryProblem]
}

public enum WallpaperLibrary {
    public static let manifestName = "wallpaper.json"

    /// Reads every `<root>/<id>/wallpaper.json`. Built-ins come first in the
    /// order given, then everything the user imported, by name.
    public static func scan(_ root: URL, builtIn: [String]) -> LibraryScan {
        let fm = FileManager.default
        guard let folders = try? fm.contentsOfDirectory(at: root, includingPropertiesForKeys: [.isDirectoryKey]) else {
            return LibraryScan(wallpapers: [], problems: [])
        }
        var found: [Wallpaper] = []
        var problems: [LibraryProblem] = []
        for folder in folders where isCandidate(folder) {
            switch load(folder, builtIn: builtIn) {
            case let .success(wallpaper): found.append(wallpaper)
            case let .failure(problem): problems.append(problem)
            }
        }
        return LibraryScan(wallpapers: sorted(found, builtIn: builtIn), problems: problems.sorted { $0.folder < $1.folder })
    }

    private static func isCandidate(_ url: URL) -> Bool {
        let name = url.lastPathComponent
        let isDir = (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false
        return isDir && !name.hasPrefix("_") && !name.hasPrefix(".")
    }

    private static func load(_ folder: URL, builtIn: [String]) -> Result<Wallpaper, LibraryProblem> {
        let name = folder.lastPathComponent
        do {
            let data = try Data(contentsOf: folder.appendingPathComponent(manifestName))
            let manifest = try Manifest.decode(data)
            guard manifest.id == name else {
                return .failure(LibraryProblem(folder: name, reason: "id \"\(manifest.id)\" does not match its folder"))
            }
            let origin = Origin.read(from: folder)
            // A community folder can never pass itself off as a built-in.
            let wallpaper = Wallpaper(manifest: manifest, folder: folder, isBuiltIn: origin == nil && builtIn.contains(manifest.id), origin: origin)
            guard FileManager.default.fileExists(atPath: wallpaper.entryURL.path) else {
                return .failure(LibraryProblem(folder: name, reason: "\(manifest.entry) is missing"))
            }
            return .success(wallpaper)
        } catch {
            return .failure(LibraryProblem(folder: name, reason: String(describing: error)))
        }
    }

    private static func sorted(_ wallpapers: [Wallpaper], builtIn: [String]) -> [Wallpaper] {
        wallpapers.sorted { a, b in
            switch (builtIn.firstIndex(of: a.id), builtIn.firstIndex(of: b.id)) {
            case let (i?, j?): i < j
            case (.some, nil): true
            case (nil, .some): false
            case (nil, nil): a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
            }
        }
    }
}

extension LibraryProblem: Error {}
