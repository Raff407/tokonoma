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

@Suite struct ShippedWallpaperTests {
    @Test func everyBuiltInPassesValidation() {
        let repo = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let scan = WallpaperLibrary.scan(repo.appendingPathComponent("Wallpapers"), builtIn: [])
        #expect(scan.problems.isEmpty, "\(scan.problems)")
        #expect(Set(scan.wallpapers.map(\.id)) == ["torii", "koi", "fuji", "kaze", "take", "sakura", "yuki", "hotaru", "tsuki", "nami", "momiji", "hoshi", "toro", "unkai", "tsuru", "neko", "hanabi", "shoji", "hasu", "kiri", "densha", "kurage", "suisha", "yokocho", "ajisai", "tanada", "shika", "fukuro", "usagi", "nagisa", "isaribi", "taki", "kazan", "onsen", "tsuyu", "kaki", "kamo", "himawari", "shiro", "icho", "tako", "koinobori", "furin", "kingyo", "chawan", "jihanki", "kintsugi", "tombo", "kaeru", "komorebi", "suzume", "tanuki", "kitsune", "iruka", "kujira", "umigame", "sango", "todai", "minato", "hashi", "gojunoto", "yamadera", "kane", "koke", "shishi", "bonsai", "ikebana", "maneki", "orizuru", "yatai", "kotatsu", "kissaten", "fumikiri", "basutei", "yakei", "kasa", "matsuri", "uma", "hakucho", "sagi", "tsubame", "ume", "tsubaki", "ayame", "higan", "fujidana", "matsu", "kakashi", "kamakura", "tsurara", "ryuhyo", "tanabata", "niji", "meoto", "sakyu", "kabuto", "jizo", "enso", "asanoha", "konbini", "kinkaku", "itsukushima", "inari", "shinkansen", "sento", "ramen", "chochin", "karesansui", "kodo", "hanaikada", "nanohana", "susuki", "juhyo", "shirakawa", "kiyomizu", "tawa", "kosaten", "izakaya", "sakagura", "kadomatsu", "hatsuhinode", "sansui", "byobu", "aizome", "saru", "cho", "medaka", "kani", "inoshishi", "mejiro", "kawasemi", "yudachi", "oboro", "kogarashi", "karasu", "danchi", "kanransha", "sakamichi", "inaho", "chabatake", "uzushio", "ryusei", "teruteru", "temari", "koma", "sensu", "irori", "andon", "tsukubai", "shodo", "engawa", "mikan", "ginkaku", "matsumoto", "todaiji", "nikko", "kegon", "kenrokuen", "togetsukyo", "kintaikyo", "yakushima", "kamikochi", "ashinoko", "shuri", "ishigaki", "asakusa", "yukimatsuri", "otaru", "takayama", "kurashiki", "kawagoe", "tsumago", "ginzan", "gion", "kotohira", "nachi", "aso", "sakurajima", "oirase", "nemophila", "furano", "kazurabashi", "ropeway", "hatsuyuki", "tsuyukusa", "kinmokusei", "sazanka", "nadeshiko", "kikyo", "hagi", "suisen", "yamabuki", "fuyubotan", "tsutsuji", "asagao", "shigure", "nyudogumo", "yuyake", "akatsuki", "shimobashira", "tsuyuake", "kitsutsuki", "hibari", "uguisu", "semi", "takotsubo", "ayu", "umineko", "washi", "kamoshika", "risu", "suzumushi", "oshidori", "momonga", "kiji", "tokonoma", "furoshiki", "kokeshi", "hinadan", "koto", "nabe", "wagashi", "tokkuri", "shippo", "uroko", "kikko", "kasuri", "ichimatsu", "dojo", "kyoshitsu", "minka", "shotengai", "hiraizumi", "izumo", "yoshino", "daibutsu", "rishiri", "yukinootani", "hanamizuki", "kohan", "kasumi", "chinden", "kakigori", "enoshima", "tsuwano", "kushiro", "aoiike", "nohbutai", "komainu", "emaki", "senko", "hikokigumo", "taue"])
    }

    @Test func importedMediaPropertiesAreWellFormed() {
        for kind in [MediaImporter.Kind.video, .image] {
            #expect(MediaImporter.properties(for: kind).allSatisfy { $0.isWellFormed })
        }
    }
}
