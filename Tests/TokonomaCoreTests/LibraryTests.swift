import Foundation
import Testing
@testable import TokonomaCore

func makeTempDir() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("tokonoma-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
}

func writeWallpaper(_ root: URL, id: String, name: String? = nil, json: String? = nil) throws {
    let folder = root.appendingPathComponent(id)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    let body = json ?? #"{"id":"\#(id)","name":"\#(name ?? id.capitalized)","entry":"index.html"}"#
    try Data(body.utf8).write(to: folder.appendingPathComponent("wallpaper.json"))
    try Data("<html></html>".utf8).write(to: folder.appendingPathComponent("index.html"))
}

@Suite struct LibraryTests {
    @Test func findsWallpapersAndSkipsReservedFolders() throws {
        let root = try makeTempDir()
        try writeWallpaper(root, id: "koi")
        try writeWallpaper(root, id: "torii")
        try FileManager.default.createDirectory(at: root.appendingPathComponent("_lib"), withIntermediateDirectories: true)
        let scan = WallpaperLibrary.scan(root, builtIn: ["torii"])
        #expect(scan.wallpapers.map(\.id) == ["torii", "koi"])
        #expect(scan.wallpapers.first?.isBuiltIn == true)
        #expect(scan.problems.isEmpty)
    }

    @Test func reportsBrokenManifestsWithoutFailingTheScan() throws {
        let root = try makeTempDir()
        try writeWallpaper(root, id: "good")
        try writeWallpaper(root, id: "bad", json: "{ not json")
        let scan = WallpaperLibrary.scan(root, builtIn: [])
        #expect(scan.wallpapers.map(\.id) == ["good"])
        #expect(scan.problems.count == 1)
        #expect(scan.problems.first?.folder == "bad")
    }

    @Test func folderAndIDMustAgree() throws {
        let root = try makeTempDir()
        try writeWallpaper(root, id: "here", json: #"{"id":"elsewhere","name":"X","entry":"index.html"}"#)
        let scan = WallpaperLibrary.scan(root, builtIn: [])
        #expect(scan.wallpapers.isEmpty)
        #expect(scan.problems.count == 1)
    }

    @Test func missingEntryFileIsAProblem() throws {
        let root = try makeTempDir()
        try writeWallpaper(root, id: "lonely", json: #"{"id":"lonely","name":"X","entry":"missing.html"}"#)
        let scan = WallpaperLibrary.scan(root, builtIn: [])
        #expect(scan.wallpapers.isEmpty)
    }

    @Test func userWallpapersSortByName() throws {
        let root = try makeTempDir()
        try writeWallpaper(root, id: "zz", name: "Alpha")
        try writeWallpaper(root, id: "aa", name: "Beta")
        let scan = WallpaperLibrary.scan(root, builtIn: [])
        #expect(scan.wallpapers.map(\.id) == ["zz", "aa"])
    }

    @Test func missingRootGivesAnEmptyLibrary() {
        let scan = WallpaperLibrary.scan(URL(fileURLWithPath: "/nonexistent/\(UUID())"), builtIn: [])
        #expect(scan.wallpapers.isEmpty)
    }

    @Test func entryURLPointsInsideTheFolder() throws {
        let root = try makeTempDir()
        try writeWallpaper(root, id: "koi")
        let wallpaper = try #require(WallpaperLibrary.scan(root, builtIn: []).wallpapers.first)
        #expect(wallpaper.entryURL.path.hasSuffix("koi/index.html"))
    }
}
