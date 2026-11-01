import CryptoKit
import Foundation
import Testing
@testable import TokonomaCore

private let repo = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()

private let scene = """
Kasuri.run({ defaults: { mode: 'glyph' }, draw(ctx, t, dt, api) { ctx.fillStyle = '#1c1a19'; ctx.fillRect(0, 0, api.cols, api.rows); } });
"""

private func manifest(id: String = "paper-moon", author: String = "Mika") -> [String: Any] {
    [
        "id": id, "name": "Paper moon", "title": "月", "author": ["name": author], "version": 1,
        "properties": [
            ["key": "mode", "label": "weave", "type": "choice", "options": ["glyph", "block", "dot", "raw"], "default": "glyph"],
            ["key": "cell", "label": "cell size", "type": "range", "min": 4, "max": 24, "step": 1, "default": 9],
        ],
    ]
}

/// Builds .tokonoma bytes the same way market/src/package.js does.
private func packageData(manifest: [String: Any] = manifest(), files: [String: [String: String]]? = nil, tamper: Bool = false) throws -> Data {
    let body: [String: Any] = ["manifest": manifest, "files": files ?? ["scene.js": ["encoding": "utf8", "data": scene]]]
    let bodyText = String(decoding: try JSONSerialization.data(withJSONObject: body), as: UTF8.self)
    let hash = SHA256.hash(data: Data(bodyText.utf8)).map { String(format: "%02x", $0) }.joined()
    let envelope: [String: Any] = [
        "format": "tokonoma-package", "formatVersion": 1, "sha256": hash,
        "body": tamper ? bodyText.replacingOccurrences(of: "#1c1a19", with: "#ff00ff") : bodyText,
    ]
    return try JSONSerialization.data(withJSONObject: envelope)
}

private func validator() throws -> PackageValidator {
    try PackageValidator(
        rules: String(contentsOf: repo.appendingPathComponent("market/src/rules.js"), encoding: .utf8),
        validate: String(contentsOf: repo.appendingPathComponent("market/src/validate.js"), encoding: .utf8)
    )
}

@Suite struct CommunityPackageTests {
    @Test func opensAVerifiedPackage() throws {
        let pkg = try CommunityPackage.open(packageData())
        #expect(pkg.id == "paper-moon")
        #expect(pkg.author == "Mika")
        #expect(pkg.files.keys.sorted() == ["scene.js"])
        #expect(pkg.sha256.count == 64)
    }

    @Test func refusesATamperedPackage() throws {
        #expect(throws: CommunityError.altered) { try CommunityPackage.open(packageData(tamper: true)) }
    }

    @Test func refusesThingsThatAreNotPackages() {
        #expect(throws: CommunityError.notAPackage) { try CommunityPackage.open(Data("hello".utf8)) }
        #expect(throws: CommunityError.notAPackage) { try CommunityPackage.open(Data(#"{"format":"zip"}"#.utf8)) }
    }

    @Test func theSharedValidatorRunsInJavaScriptCore() throws {
        let report = try validator().validate(CommunityPackage.open(packageData()))
        #expect(report.ok, "\(report.errors)")
        #expect(report.facts.author == "Mika")
        #expect(report.facts.grid.hasPrefix("168 × 110"))
    }

    @Test func theValidatorCatchesUnsafeScenes() throws {
        let bad = try packageData(files: ["scene.js": ["encoding": "utf8", "data": scene + "\nfetch('https://x.example');"]])
        let report = try validator().validate(CommunityPackage.open(bad))
        #expect(!report.ok)
        #expect(report.errors.contains { $0.code == "network" })
    }
}

@Suite struct CommunityInstallTests {
    @Test func installsWithAnOriginAndATrustedPage() throws {
        let root = try makeTempDir()
        let pkg = try CommunityPackage.open(packageData())
        let facts = try validator().validate(pkg).facts

        let wallpaper = try CommunityInstaller.install(pkg, facts: facts, into: root, existing: [])

        #expect(wallpaper.origin?.source == .community)
        #expect(wallpaper.origin?.author == "Mika")
        #expect(wallpaper.origin?.verified == false)
        let html = try String(contentsOf: wallpaper.entryURL, encoding: .utf8)
        #expect(html.contains(#"<script src="scene.js"></script>"#))
        #expect(!html.contains("_lib"))
        let rescanned = WallpaperLibrary.scan(root, builtIn: [])
        #expect(rescanned.wallpapers.first?.origin?.source == .community)
        #expect(rescanned.wallpapers.first?.isBuiltIn == false)
    }

    @Test func neverReplacesABuiltInOrSomethingYouImported() throws {
        let root = try makeTempDir()
        try writeWallpaper(root, id: "torii")
        let builtIn = WallpaperLibrary.scan(root, builtIn: ["torii"]).wallpapers
        let pkg = try CommunityPackage.open(packageData(manifest: manifest(id: "torii")))
        #expect(throws: CommunityError.idTaken("torii")) {
            try CommunityInstaller.install(pkg, facts: nil, into: root, existing: builtIn)
        }
        #expect(FileManager.default.fileExists(atPath: root.appendingPathComponent("torii/index.html").path))
    }

    @Test func updatesAnEarlierCommunityInstall() throws {
        let root = try makeTempDir()
        let pkg = try CommunityPackage.open(packageData())
        _ = try CommunityInstaller.install(pkg, facts: nil, into: root, existing: [])
        let existing = WallpaperLibrary.scan(root, builtIn: []).wallpapers
        let again = try CommunityInstaller.install(pkg, facts: nil, into: root, existing: existing)
        #expect(again.id == "paper-moon")
    }

    @Test func someoneElseCantUpdateYourInstall() throws {
        let root = try makeTempDir()
        _ = try CommunityInstaller.install(try CommunityPackage.open(packageData()), facts: nil, into: root, existing: [])
        let existing = WallpaperLibrary.scan(root, builtIn: []).wallpapers
        let takeover = try CommunityPackage.open(packageData(manifest: manifest(author: "Mallory")))
        #expect(throws: CommunityError.otherAuthor(installed: "Mika", incoming: "Mallory")) {
            try CommunityInstaller.install(takeover, facts: nil, into: root, existing: existing)
        }
    }

    @Test func hugeFilesAreNotEvenParsed() {
        #expect(throws: CommunityError.tooBig(CommunityPackage.maxBytes + 1)) {
            try CommunityPackage.open(Data(count: CommunityPackage.maxBytes + 1))
        }
    }

    @Test func refusesPathsOutsideThePackage() throws {
        let root = try makeTempDir()
        let pkg = try CommunityPackage.open(packageData(files: [
            "scene.js": ["encoding": "utf8", "data": scene],
            "../escape.js": ["encoding": "utf8", "data": "x"],
        ]))
        #expect(throws: CommunityError.self) { try CommunityInstaller.install(pkg, facts: nil, into: root, existing: []) }
        #expect(!FileManager.default.fileExists(atPath: root.deletingLastPathComponent().appendingPathComponent("escape.js").path))
    }
}
