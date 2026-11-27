import CryptoKit
import Foundation
import JavaScriptCore

/// Where a wallpaper came from. Written by the app at install time, never by
/// the wallpaper's author, so a package can't claim to be verified.
public struct Origin: Codable, Equatable, Hashable, Sendable {
    public enum Source: String, Codable, Sendable { case community }

    public let source: Source
    public let author: String
    public let authorURL: String?
    public let sha256: String
    public let installedAt: Date
    public let verified: Bool
    public let packageBytes: Int?
    public let grid: String?

    static let fileName = ".origin.json"

    static func read(from folder: URL) -> Origin? {
        guard let data = try? Data(contentsOf: folder.appendingPathComponent(fileName)) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(Origin.self, from: data)
    }
}

public enum CommunityError: Error, Equatable, CustomStringConvertible {
    case notAPackage
    case unsupportedFormat(Int)
    case altered
    case badFile(String)
    case idTaken(String)
    case validatorBroken(String)
    case tooBig(Int)
    case otherAuthor(installed: String, incoming: String)

    public var description: String {
        switch self {
        case .notAPackage: "This isn't a Tokonoma wallpaper package."
        case let .unsupportedFormat(v): "This package uses format \(v), which this version of Tokonoma can't read."
        case .altered: "The package doesn't match its fingerprint, so it may have been altered after it was made. It wasn't installed."
        case let .badFile(path): "The package contains \(path), which isn't allowed."
        case let .idTaken(id): "\"\(id)\" is already used by a wallpaper that didn't come from the community, so it was left alone."
        case let .validatorBroken(why): "The safety checks couldn't run (\(why)), so nothing was installed."
        case let .tooBig(bytes): "This package is \(bytes / 1_048_576) MB, far over the package limit, so it wasn't opened."
        case let .otherAuthor(installed, incoming): "You already have this wallpaper from \(installed). This one is by \(incoming), so it wasn't installed over it. Remove the old one first if you want to switch."
        }
    }
}

/// A .tokonoma file, opened and fingerprint-checked. Nothing on disk yet.
/// The format is package.js's: { format, formatVersion, sha256, body }, where
/// body is the JSON text of { manifest, files } and sha256 is its hash.
public struct CommunityPackage: Sendable {
    public let id: String
    public let name: String
    public let author: String
    public let authorURL: String?
    public let manifestJSON: Data
    public let files: [String: Data]
    public let sha256: String
    public let byteCount: Int

    /// Bigger than any legal package (17 MB of media, base64) with room to spare;
    /// anything past it isn't even parsed.
    public static let maxBytes = 24 * 1024 * 1024

    public static func open(_ data: Data) throws -> CommunityPackage {
        guard data.count <= maxBytes else { throw CommunityError.tooBig(data.count) }
        guard let envelope = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              envelope["format"] as? String == "tokonoma-package",
              let body = envelope["body"] as? String,
              let claimed = envelope["sha256"] as? String
        else { throw CommunityError.notAPackage }
        let version = envelope["formatVersion"] as? Int ?? 0
        guard version == 1 else { throw CommunityError.unsupportedFormat(version) }
        let actual = SHA256.hash(data: Data(body.utf8)).map { String(format: "%02x", $0) }.joined()
        guard actual == claimed else { throw CommunityError.altered }

        guard let parsed = (try? JSONSerialization.jsonObject(with: Data(body.utf8))) as? [String: Any],
              let manifest = parsed["manifest"] as? [String: Any],
              let rawFiles = parsed["files"] as? [String: [String: String]]
        else { throw CommunityError.notAPackage }

        var files: [String: Data] = [:]
        for (path, file) in rawFiles {
            switch (file["encoding"], file["data"]) {
            case let ("utf8", text?): files[path] = Data(text.utf8)
            case let ("base64", text?):
                guard let bytes = Data(base64Encoded: text) else { throw CommunityError.badFile(path) }
                files[path] = bytes
            default: throw CommunityError.badFile(path)
            }
        }
        let author = manifest["author"] as? [String: Any]
        return CommunityPackage(
            id: manifest["id"] as? String ?? "",
            name: manifest["name"] as? String ?? "Untitled",
            author: author?["name"] as? String ?? "unknown",
            authorURL: author?["url"] as? String,
            manifestJSON: try JSONSerialization.data(withJSONObject: manifest),
            files: files,
            sha256: actual,
            byteCount: data.count
        )
    }

    /// Media wallpapers: one clip or picture, no code.
    public var isMedia: Bool {
        ((try? JSONSerialization.jsonObject(with: manifestJSON)) as? [String: Any])?["kind"] as? String == "media"
    }

    /// The validator reads sizes and headers, never whole clips, so binaries
    /// past this many bytes are handed over truncated (with their real size).
    static let headerBytes = 512 * 1024

    /// The shape validate.js expects: text for scripts, byte arrays for images.
    func validatorInput() throws -> String {
        var files: [String: Any] = [:]
        for (path, data) in self.files {
            if path.hasSuffix(".js") || path.hasSuffix(".md") {
                files[path] = ["size": data.count, "text": String(decoding: data, as: UTF8.self)]
            } else {
                files[path] = ["size": data.count, "bytes": [UInt8](data.prefix(Self.headerBytes))]
            }
        }
        let manifest = try JSONSerialization.jsonObject(with: manifestJSON)
        let input: [String: Any] = ["manifest": manifest, "files": files]
        return String(decoding: try JSONSerialization.data(withJSONObject: input), as: UTF8.self)
    }
}

public struct ValidationReport: Decodable, Sendable {
    public struct Issue: Codable, Sendable, Equatable {
        public let code: String
        public let message: String
    }

    public struct Asset: Codable, Sendable, Equatable {
        public let path: String
        public let width: Int
        public let height: Int
        public let bytes: Int
    }

    public struct Media: Codable, Sendable, Equatable {
        public let type: String
        public let width: Int
        public let height: Int
        public let seconds: Double?
        public let bytes: Int
    }

    public struct Facts: Codable, Sendable, Equatable {
        public let kind: String?
        public let media: Media?
        public let author: String?
        public let packageBytes: Int
        public let sceneBytes: Int
        public let assetBytes: Int
        public let files: Int
        public let assets: [Asset]
        public let grid: String
        public let interactive: Bool
        public let settings: Int
    }

    public let ok: Bool
    public let errors: [Issue]
    public let warnings: [Issue]
    public let facts: Facts
}

/// validate.js `judgeScreen`: did the nudity screen run, and did it come back clean.
public struct ScreenReport: Decodable, Sendable {
    public let ok: Bool
    public let errors: [ValidationReport.Issue]
}

/// Runs market/src/validate.js, the same file the MCP server
/// use, inside JavaScriptCore. One set of rules, checked again on this Mac.
public final class PackageValidator: @unchecked Sendable {
    private let context: JSContext

    public init(rules: String, validate: String) throws {
        guard let context = JSContext() else { throw CommunityError.validatorBroken("no JavaScript engine") }
        var failure: String?
        context.exceptionHandler = { _, value in failure = value?.toString() }
        context.evaluateScript(rules)
        context.evaluateScript(validate)
        if let failure { throw CommunityError.validatorBroken(failure) }
        guard context.objectForKeyedSubscript("TokonomaValidate")?.isUndefined == false else {
            throw CommunityError.validatorBroken("validator didn't load")
        }
        self.context = context
    }

    public func validate(_ pkg: CommunityPackage) throws -> ValidationReport {
        context.setObject(try pkg.validatorInput(), forKeyedSubscript: "__input" as NSString)
        context.setObject(pkg.byteCount, forKeyedSubscript: "__bytes" as NSString)
        let script = "JSON.stringify(TokonomaValidate.validatePackage(JSON.parse(__input), { packageBytes: __bytes }))"
        guard let json = context.evaluateScript(script)?.toString(), json != "undefined" else {
            throw CommunityError.validatorBroken(context.exception?.toString() ?? "no result")
        }
        return try JSONDecoder().decode(ValidationReport.self, from: Data(json.utf8))
    }

    /// The threshold lives in rules.js, so the app and agents judge alike.
    public func judge(_ verdict: SafetyVerdict) throws -> ScreenReport {
        context.setObject(String(decoding: try JSONEncoder().encode(verdict), as: UTF8.self), forKeyedSubscript: "__screen" as NSString)
        guard let json = context.evaluateScript("JSON.stringify(TokonomaValidate.judgeScreen(JSON.parse(__screen)))")?.toString(),
              json != "undefined"
        else { throw CommunityError.validatorBroken(context.exception?.toString() ?? "no screen verdict") }
        return try JSONDecoder().decode(ScreenReport.self, from: Data(json.utf8))
    }
}

/// Writes a checked package into the library. Only ever writes the files it
/// expects, under names it chose, and generates the page itself.
public enum CommunityInstaller {
    static let allowed = try! NSRegularExpression(pattern: #"^(scene\.js|README\.md|assets/[a-z0-9][a-z0-9._-]{0,60}\.(png|jpe?g|webp)|media\.(mp4|jpe?g|png|webp))$"#)
    static let mediaName = try! NSRegularExpression(pattern: #"^media\.(mp4|jpe?g|png|webp)$"#)

    /// The only HTML a community wallpaper ever gets. kasuri is injected by the
    /// app at load time, so the page can't reach the shared library folder.
    public static func page(title: String) -> String {
        let safe = title.replacingOccurrences(of: "<", with: "").replacingOccurrences(of: "&", with: "")
        return """
        <!doctype html>
        <html lang="en">
        <head><meta charset="utf-8"><title>\(safe)</title></head>
        <body>
        <script src="scene.js"></script>
        </body>
        </html>
        """
    }

    /// A shared clip or picture gets the same page an import does, minus the
    /// script tags: kasuri and media.js are injected, like every community page.
    public static func mediaPage(title: String, media: String) -> String {
        let safe = title.replacingOccurrences(of: "<", with: "").replacingOccurrences(of: "&", with: "")
        return """
        <!doctype html>
        <html lang="en">
        <head><meta charset="utf-8"><title>\(safe)</title></head>
        <body data-media="\(media)"></body>
        </html>
        """
    }

    /// What the "grid" line says: cells for a scene, size and length for media.
    public static func describeGrid(_ facts: ValidationReport.Facts) -> String {
        guard let media = facts.media else { return facts.grid }
        let length = media.seconds.map { String(format: " · %.0f s", $0) } ?? ""
        return "\(media.type) \(media.width)×\(media.height)\(length), woven to fit any display"
    }

    @discardableResult
    public static func install(_ pkg: CommunityPackage, facts: ValidationReport.Facts?, into root: URL, existing: [Wallpaper]) throws -> Wallpaper {
        guard Manifest.isSafeName(pkg.id), pkg.id == pkg.id.lowercased() else { throw CommunityError.badFile("id \(pkg.id)") }
        for path in pkg.files.keys {
            let range = NSRange(path.startIndex..., in: path)
            guard allowed.firstMatch(in: path, range: range) != nil else { throw CommunityError.badFile(path) }
        }
        if let clash = existing.first(where: { $0.id.lowercased() == pkg.id }) {
            guard let origin = clash.origin, origin.source == .community else { throw CommunityError.idTaken(pkg.id) }
            // An "update" from someone else is a takeover, not an update.
            guard origin.author == pkg.author else { throw CommunityError.otherAuthor(installed: origin.author, incoming: pkg.author) }
        }
        let fm = FileManager.default
        let target = root.appendingPathComponent(pkg.id)
        if fm.fileExists(atPath: target.path), Origin.read(from: target) == nil {
            throw CommunityError.idTaken(pkg.id)
        }

        let incoming = root.appendingPathComponent(".\(pkg.id).incoming")
        try? fm.removeItem(at: incoming)
        do {
            try fm.createDirectory(at: incoming, withIntermediateDirectories: true)
            for (path, data) in pkg.files {
                let file = incoming.appendingPathComponent(path)
                try fm.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
                try data.write(to: file)
            }
            var manifest = (try JSONSerialization.jsonObject(with: pkg.manifestJSON) as? [String: Any]) ?? [:]
            manifest["entry"] = "index.html"
            let media = manifest["media"] as? String
            let html: String
            if pkg.isMedia, let media, mediaName.firstMatch(in: media, range: NSRange(media.startIndex..., in: media)) != nil,
               pkg.files[media] != nil {
                html = mediaPage(title: pkg.name, media: media)
            } else if pkg.isMedia {
                throw CommunityError.badFile("media")
            } else {
                manifest["media"] = nil
                html = page(title: pkg.name)
            }
            try JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys])
                .write(to: incoming.appendingPathComponent(WallpaperLibrary.manifestName))
            try Data(html.utf8).write(to: incoming.appendingPathComponent("index.html"))

            let origin = Origin(
                source: .community, author: pkg.author, authorURL: pkg.authorURL, sha256: pkg.sha256,
                installedAt: Date(), verified: false, packageBytes: pkg.byteCount, grid: facts.map(describeGrid)
            )
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(origin).write(to: incoming.appendingPathComponent(Origin.fileName))

            if fm.fileExists(atPath: target.path) {
                _ = try fm.replaceItemAt(target, withItemAt: incoming)
            } else {
                try fm.moveItem(at: incoming, to: target)
            }
        } catch {
            try? fm.removeItem(at: incoming)
            throw error
        }
        guard let installed = WallpaperLibrary.scan(root, builtIn: []).wallpapers.first(where: { $0.id == pkg.id }) else {
            throw CommunityError.badFile("wallpaper.json")
        }
        return installed
    }
}
