import Foundation
import Testing
@testable import TokonomaCore

@Suite struct SettingsTests {
    @Test func assigningReturnsANewValue() {
        let base = Settings.default
        let next = base.assigning("koi", to: "display-1")
        #expect(base.assignments.isEmpty)
        #expect(next.wallpaper(for: "display-1") == "koi")
        #expect(next.wallpaper(for: "display-2") == base.fallbackWallpaper)
    }

    @Test func assigningEverywhereClearsPerDisplayChoices() {
        let s = Settings.default.assigning("koi", to: "a").assigningEverywhere("sumi")
        #expect(s.assignments.isEmpty)
        #expect(s.fallbackWallpaper == "sumi")
        #expect(s.wallpaper(for: "a") == "sumi")
    }

    @Test func overridesMergePerWallpaper() {
        let s = Settings.default
            .setting("wind", to: .number(2), for: "torii")
            .setting("fox", to: .flag(false), for: "torii")
            .setting("fish", to: .number(3), for: "koi")
        #expect(s.overrides["torii"] == ["wind": .number(2), "fox": .flag(false)])
        #expect(s.overrides["koi"] == ["fish": .number(3)])
    }

    @Test func resettingDropsOverrides() {
        let s = Settings.default.setting("wind", to: .number(2), for: "torii").resetting("torii")
        #expect(s.overrides["torii"] == nil)
    }

    @Test func forgettingAWallpaperCleansUp() {
        let s = Settings.default
            .assigning("clip", to: "a")
            .assigningEverywhere("clip")
            .setting("cell", to: .number(4), for: "clip")
            .forgetting("clip", fallback: "torii")
        #expect(s.fallbackWallpaper == "torii")
        #expect(s.assignments.isEmpty)
        #expect(s.overrides["clip"] == nil)
    }

    @Test func storeRoundTripsToDisk() throws {
        let dir = try makeTempDir()
        let store = SettingsStore(url: dir.appendingPathComponent("settings.json"))
        let saved = Settings.default.assigning("koi", to: "x").with(\.fpsCap, 24)
        try store.save(saved)
        #expect(store.load() == saved)
    }

    @Test func storeFallsBackToDefaultsOnGarbage() throws {
        let dir = try makeTempDir()
        let url = dir.appendingPathComponent("settings.json")
        try Data("nope".utf8).write(to: url)
        #expect(SettingsStore(url: url).load() == .default)
    }

    @Test func aCorruptFileIsKeptAsideNotOverwritten() throws {
        let dir = try makeTempDir()
        let url = dir.appendingPathComponent("settings.json")
        try Data("{ half a file".utf8).write(to: url)
        let (settings, backup) = SettingsStore(url: url).loadRecovering()
        #expect(settings == .default)
        let kept = try #require(backup)
        #expect(try String(contentsOf: kept, encoding: .utf8) == "{ half a file")
        #expect(!FileManager.default.fileExists(atPath: url.path))
    }

    @Test func aMissingFileIsNotACorruption() throws {
        let dir = try makeTempDir()
        let (_, backup) = SettingsStore(url: dir.appendingPathComponent("settings.json")).loadRecovering()
        #expect(backup == nil)
    }

    @Test func olderFilesMissingKeysStillLoad() throws {
        let dir = try makeTempDir()
        let url = dir.appendingPathComponent("settings.json")
        try Data(#"{"fallbackWallpaper":"koi"}"#.utf8).write(to: url)
        let loaded = SettingsStore(url: url).load()
        #expect(loaded.fallbackWallpaper == "koi")
        #expect(loaded.pauseWhenCovered == Settings.default.pauseWhenCovered)
        #expect(loaded.authorName == "")
    }

    @Test func theNameYouPublishUnderIsRemembered() throws {
        let store = SettingsStore(url: try makeTempDir().appendingPathComponent("settings.json"))
        try store.save(Settings.default.with(\.authorName, "Raff"))
        #expect(store.load().authorName == "Raff")
    }
}
