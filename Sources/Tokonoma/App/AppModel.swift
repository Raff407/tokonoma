import AppKit
import Combine
import TokonomaCore

/// A community package that passed the checks and is waiting for the user's yes.
struct PendingInstall: Identifiable {
    let id = UUID()
    let package: CommunityPackage
    let report: ValidationReport
    let replaces: Bool
}

/// One of your imports on its way to the marketplace (or kept private).
struct ShareDraft: Identifiable {
    let id = UUID()
    let wallpaper: Wallpaper
    /// Shown right after an import, where "keep it private" is the default.
    let justImported: Bool
}

enum ShareState: Equatable {
    case idle
    case working(String)
    case failed(String)
    case published(MarketEntry, trimmed: Bool)
}

struct DisplayInfo: Identifiable, Equatable {
    let id: String
    let name: String
}

/// The app's single source of truth. Views and the menu read from it and
/// call its intents; it owns the desktop windows and keeps them in step.
@MainActor
final class AppModel: ObservableObject {
    @Published private(set) var wallpapers: [Wallpaper] = []
    @Published private(set) var settings: Settings
    @Published private(set) var problems: [LibraryProblem] = []
    @Published private(set) var displays: [DisplayInfo] = []
    @Published private(set) var playback: [String: Playback] = [:]
    @Published private(set) var thumbnails: [String: NSImage] = [:]
    @Published var notice: String?
    @Published private(set) var importing = 0
    @Published var pendingInstall: PendingInstall?
    @Published private(set) var market: [MarketEntry] = []
    @Published var shareDraft: ShareDraft?
    @Published private(set) var shareState: ShareState = .idle
    @Published private(set) var checking: String?

    static let builtInOrder = ["torii", "koi", "sumi", "fuji", "kaze", "take", "sakura", "yuki", "hotaru", "tsuki", "nami", "niwa", "momiji", "hoshi", "toro", "unkai", "tsuru", "neko", "hanabi", "shoji", "hasu", "kiri", "densha", "kurage", "suisha"]

    let paths: Paths
    let isFirstRun: Bool
    let agents: AgentServer
    private let store: SettingsStore
    private let desktop = DesktopController()
    private let monitor = SystemMonitor()
    private let pointer = PointerTracker()
    private var builtIns: [String] = []
    private var rotationTimer: Timer?
    private var pendingSave: DispatchWorkItem?
    private var scheduledMinutes: Int?
    private var pointerDisplay: String?
    private lazy var thumbnailer = Thumbnailer(paths: paths, isolation: { [weak self] in self?.isolation(for: $0) }) { [weak self] id, image in
        self?.thumbnails[id] = image
    }
    /// The same validate.js the MCP server and registry run, here in JavaScriptCore.
    private lazy var validator: PackageValidator? = {
        do {
            return try PackageValidator(
                rules: String(contentsOf: paths.marketScripts.appendingPathComponent("rules.js"), encoding: .utf8),
                validate: String(contentsOf: paths.marketScripts.appendingPathComponent("validate.js"), encoding: .utf8)
            )
        } catch {
            NSLog("tokonoma: package validator unavailable: \(error)")
            return nil
        }
    }()
    private lazy var kasuriSources: [String] = paths.kasuriScripts.compactMap { try? String(contentsOf: $0, encoding: .utf8) }
    private lazy var mediaSource: String? = try? String(contentsOf: paths.mediaScript, encoding: .utf8)
    private lazy var registry = MarketRegistry(root: paths.registry)
    /// Loaded the first time something is shared or installed, then kept.
    private var safetyScreen: SafetyScreen?

    init(paths: Paths = .standard()) {
        self.paths = paths
        agents = AgentServer(script: paths.mcpServer)
        store = SettingsStore(url: paths.settings)
        isFirstRun = !FileManager.default.fileExists(atPath: paths.settings.path)
        let (loaded, backup) = store.loadRecovering()
        settings = loaded
        if let backup {
            notice = "Your settings file couldn't be read, so Tokonoma started fresh. The old file is at \(backup.path)."
        }
    }

    func start() {
        // Built-in-ness comes from the bundle, so a failed copy can never make a
        // shipped scene look like an import that "Remove" would delete.
        builtIns = BundleSync.builtInIDs(in: paths.bundledWallpapers)
        do {
            let installed = try BundleSync.install(from: paths.bundledWallpapers, into: paths.library)
            if !installed.failures.isEmpty {
                NSLog("tokonoma: some built-ins failed to update: \(installed.failures)")
                notice = "Some built-in scenes couldn't be updated: \(installed.failures.keys.sorted().joined(separator: ", ")). The previous copies are still in place."
            }
        } catch {
            NSLog("tokonoma: could not install built-in wallpapers: \(error)")
            notice = "The built-in wallpapers couldn't be copied into your library. \(error.localizedDescription)"
        }
        rescan()
        refreshMarket()
        desktop.onChange = { [weak self] in self?.refreshDesks() }
        desktop.onError = { [weak self] message in self?.notice = "A wallpaper hit a problem: \(message)" }
        monitor.onChange = { [weak self] _ in self?.refreshPlayback() }
        pointer.onMove = { [weak self] point in self?.forwardPointer(point) }
        pointer.onClick = { [weak self] point in self?.forwardClick(point) }
        monitor.start()
        desktop.syncScreens()
        followCursorIfUseful()
        scheduleRotation()
        thumbnailer.render(wallpapers)
        // Write defaults once so the library only greets you on the very first launch.
        if isFirstRun { saveNow() }
    }

    func stop() {
        if pendingSave != nil { saveNow() }
        agents.stop()
        pointer.stop()
        desktop.tearDown()
    }

    // MARK: - Reading

    /// Community wallpapers get kasuri injected and can read only their own
    /// folder. Shared clips and pictures get the media player injected too.
    func isolation(for wallpaper: Wallpaper) -> [String]? {
        guard wallpaper.isCommunity else { return nil }
        guard wallpaper.isMedia else { return kasuriSources }
        return kasuriSources + [mediaSource].compactMap { $0 }
    }

    func wallpaper(_ id: String) -> Wallpaper? {
        wallpapers.first { $0.id == id }
    }

    func properties(for wallpaper: Wallpaper) -> [String: PropertyValue] {
        PropertyResolver.resolve(wallpaper.manifest.properties, overrides: settings.overrides[wallpaper.id] ?? [:])
    }

    func shown(on display: String) -> String {
        settings.wallpaper(for: display)
    }

    func isShownAnywhere(_ id: String) -> Bool {
        displays.contains { shown(on: $0.id) == id }
    }

    var summary: String {
        if importing > 0 { return "Importing…" }
        if let checking { return "Checking \(checking)…" }
        if settings.userPaused { return "Paused" }
        let states = Array(playback.values)
        if states.isEmpty { return "Starting" }
        if states.allSatisfy(\.isPlaying) { return "Playing" }
        if let reason = states.compactMap({ if case let .pause(r) = $0 { r } else { nil } }).first {
            return Self.describe(reason)
        }
        return "Playing"
    }

    static func describe(_ reason: PauseReason) -> String {
        switch reason {
        case .user: "Paused"
        case .asleep: "Resting while the screen is off"
        case .covered: "Resting behind your windows"
        case .battery: "Resting on battery"
        case .lowPower: "Resting in Low Power Mode"
        case .hot: "Resting while the Mac cools down"
        }
    }

    // MARK: - Intents

    func show(_ id: String, on display: String? = nil) {
        update { s in display.map { s.assigning(id, to: $0) } ?? s.assigningEverywhere(id) }
    }

    func set(_ key: String, to value: PropertyValue, for id: String) {
        update { $0.setting(key, to: value, for: id) }
    }

    func reset(_ id: String) {
        update { $0.resetting(id) }
    }

    func togglePause() {
        update { $0.with(\.userPaused, !$0.userPaused) }
    }

    func change(_ transform: (Settings) -> Settings) {
        update(transform)
    }

    /// Moves the shared scene along. Displays you gave their own scene keep it.
    func showNext() {
        guard let next = Rotation.next(after: settings.fallbackWallpaper, in: wallpapers.map(\.id)) else { return }
        update { $0.with(\.fallbackWallpaper, next) }
    }

    /// Copies happen off the main thread, so a big video never freezes the
    /// menu, the library or the desktop while it lands.
    @discardableResult
    func importFiles(_ urls: [URL]) async -> [String] {
        let packages = urls.filter { $0.pathExtension.lowercased() == "tokonoma" }
        if let first = packages.first { review(first) }
        let urls = urls.filter { $0.pathExtension.lowercased() != "tokonoma" }
        guard !urls.isEmpty else { return [] }
        guard let template = try? String(contentsOf: paths.mediaTemplate, encoding: .utf8) else {
            notice = ImportError.badTemplate.description
            return []
        }
        importing += urls.count
        defer { importing -= urls.count }
        let library = paths.library
        let outcome = await Task.detached(priority: .userInitiated) { () -> (added: [String], failures: [String]) in
            var added: [String] = []
            var failures: [String] = []
            for url in urls {
                do {
                    added.append(try await MediaImporter.importMedia(from: url, into: library, template: template).id)
                } catch let error as ImportError {
                    failures.append("\(url.lastPathComponent): \(error.description)")
                } catch {
                    failures.append("\(url.lastPathComponent): \(error.localizedDescription)")
                }
            }
            return (added, failures)
        }.value
        rescan()
        thumbnailer.render(wallpapers.filter { outcome.added.contains($0.id) })
        if !outcome.failures.isEmpty { notice = outcome.failures.joined(separator: "\n") }
        // One file at a time gets the private-or-publish choice; a batch stays private.
        if outcome.added.count == 1, let added = wallpaper(outcome.added[0]) {
            share(added, justImported: true)
        }
        return outcome.added
    }

    // MARK: - Community packages

    /// Opens a .tokonoma, checks its fingerprint, runs every rule on it and
    /// screens its pictures and clips. Nothing is installed here: a clean
    /// package waits for the user's yes.
    func review(_ url: URL) {
        guard let data = try? Data(contentsOf: url) else {
            notice = "\(url.lastPathComponent) couldn't be opened."
            return
        }
        Task { await review(data, label: url.lastPathComponent) }
    }

    func install(_ entry: MarketEntry) {
        do {
            let data = try registry.download(entry)
            Task { await review(data, label: entry.name) }
        } catch {
            notice = (error as? CustomStringConvertible)?.description ?? error.localizedDescription
        }
    }

    private func review(_ data: Data, label: String) async {
        checking = label
        defer { checking = nil }
        do {
            let package = try CommunityPackage.open(data)
            guard let validator else { throw CommunityError.validatorBroken("the checks are missing from this copy of Tokonoma") }
            let report = try validator.validate(package)
            guard report.ok else {
                notice = "“\(package.name)” wasn't installed because it failed the checks:\n"
                    + report.errors.map { "• \($0.message)" }.joined(separator: "\n")
                return
            }
            // Screened again here: a check that only ran on someone else's Mac doesn't count.
            let screen = try await loadSafetyScreen()
            let verdict = try await Task.detached(priority: .userInitiated) { try await screen.screen(package: package) }.value
            if verdict.frames > 0 || package.isMedia {
                let judged = try validator.judge(verdict)
                guard judged.ok else {
                    notice = "“\(package.name)” wasn't installed: " + judged.errors.map(\.message).joined(separator: "; ")
                    return
                }
            }
            pendingInstall = PendingInstall(package: package, report: report, replaces: wallpaper(package.id)?.isCommunity == true)
        } catch {
            notice = (error as? CustomStringConvertible)?.description ?? "\(label) couldn't be opened: \(error.localizedDescription)"
        }
    }

    private func loadSafetyScreen() async throws -> SafetyScreen {
        if let safetyScreen { return safetyScreen }
        let screen = try await SafetyScreen.load(model: paths.nsfwModel, cache: paths.modelCache)
        safetyScreen = screen
        return screen
    }

    // MARK: - Marketplace

    func refreshMarket() {
        market = registry.list().sorted { $0.publishedAt > $1.publishedAt }
    }

    func preview(for entry: MarketEntry) -> URL? {
        registry.previewURL(entry)
    }

    /// The marketplace copy of one of yours, if you've published it.
    func listing(for wallpaper: Wallpaper) -> MarketEntry? {
        let id = Publisher.marketID(for: wallpaper.name)
        return market.first { $0.isMedia && $0.id == id && $0.author == settings.authorName && !settings.authorName.isEmpty }
    }

    func share(_ wallpaper: Wallpaper, justImported: Bool = false) {
        guard wallpaper.isMedia, !wallpaper.isCommunity, !wallpaper.isBuiltIn else { return }
        shareState = .idle
        shareDraft = ShareDraft(wallpaper: wallpaper, justImported: justImported)
    }

    func closeShare() {
        shareDraft = nil
        shareState = .idle
    }

    /// Light copy → nudity screen → package → validate.js → listed. Any no stops it.
    func publish(_ wallpaper: Wallpaper, name: String, description: String, author: String) {
        let author = author.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !author.isEmpty, !name.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        guard let validator else {
            shareState = .failed(CommunityError.validatorBroken("the checks are missing from this copy of Tokonoma").description)
            return
        }
        update { $0.with(\.authorName, author) }
        shareState = .working("Making a light copy and screening it")
        let request = Publisher.Request(
            wallpaper: wallpaper, name: name, description: description, author: author, values: properties(for: wallpaper)
        )
        let registry = registry
        let preview = thumbnailer.cachedJPEG(for: wallpaper)
        Task {
            do {
                let screen = try await loadSafetyScreen()
                let result = try await Task.detached(priority: .userInitiated) {
                    try await Publisher.publish(request, registry: registry, validator: validator, screen: screen, preview: preview)
                }.value
                refreshMarket()
                shareState = .published(result.entry, trimmed: result.trimmed)
            } catch {
                shareState = .failed((error as? CustomStringConvertible)?.description ?? error.localizedDescription)
            }
        }
    }

    @discardableResult
    func confirmInstall() -> String? {
        guard let pending = pendingInstall else { return nil }
        pendingInstall = nil
        do {
            let installed = try CommunityInstaller.install(pending.package, facts: pending.report.facts, into: paths.library, existing: wallpapers)
            rescan()
            thumbnailer.forget(installed.id)
            thumbnailer.render([installed])
            return installed.id
        } catch let error as CommunityError {
            notice = error.description
        } catch {
            notice = "“\(pending.package.name)” couldn't be installed: \(error.localizedDescription)"
        }
        return nil
    }

    func remove(_ id: String) {
        guard let wallpaper = wallpaper(id) else { return }
        do {
            try MediaImporter.remove(wallpaper)
            thumbnailer.forget(id)
            thumbnails[id] = nil
            rescan()
            update { $0.forgetting(id, fallback: self.builtIns.first ?? "torii") }
        } catch let error as ImportError {
            notice = error.description
        } catch {
            notice = "Couldn't remove \(wallpaper.name): \(error.localizedDescription)"
        }
    }

    // MARK: - Plumbing

    private func rescan() {
        let order = Self.builtInOrder.filter(builtIns.contains) + builtIns.filter { !Self.builtInOrder.contains($0) }
        let scan = WallpaperLibrary.scan(paths.library, builtIn: order)
        wallpapers = scan.wallpapers
        problems = scan.problems
        for problem in scan.problems { NSLog("tokonoma: skipped \(problem.folder): \(problem.reason)") }
    }

    private func update(_ change: (Settings) -> Settings) {
        let next = change(settings)
        guard next != settings else { return }
        settings = next
        scheduleSave()
        refreshDesks()
        followCursorIfUseful()
        scheduleRotation()
    }

    /// Slider drags change settings many times a second; write the file once they settle.
    private func scheduleSave() {
        pendingSave?.cancel()
        let work = DispatchWorkItem { [weak self] in
            MainActor.assumeIsolated { self?.saveNow() }
        }
        pendingSave = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: work)
    }

    func saveNow() {
        pendingSave?.cancel()
        pendingSave = nil
        do {
            try store.save(settings)
        } catch {
            notice = "Your settings couldn't be saved: \(error.localizedDescription)"
        }
    }

    private func refreshDesks() {
        displays = desktop.displays
        for (display, desk) in desktop.desks {
            guard let wallpaper = wallpaper(settings.wallpaper(for: display)) ?? wallpapers.first else { continue }
            let props = properties(for: wallpaper)
            if desk.host.wallpaperID == wallpaper.id {
                desk.host.apply(props)
            } else {
                desk.host.load(wallpaper, properties: props, root: paths.library, isolation: isolation(for: wallpaper))
            }
        }
        refreshPlayback()
    }

    private func refreshPlayback() {
        var next: [String: Playback] = [:]
        for (display, desk) in desktop.desks {
            let conditions = monitor.conditions.with(\.covered, desk.window.isCovered)
            let decision = PlaybackPolicy.decide(conditions, settings)
            next[display] = decision
            desk.host.setScale(PlaybackPolicy.renderScale(conditions, settings))
            switch decision {
            case let .play(fps):
                desk.host.setFps(fps)
                desk.host.setPaused(false)
            case .pause:
                desk.host.setPaused(true)
            }
        }
        if next != playback { playback = next }
    }

    private func followCursorIfUseful() {
        let interactive = desktop.desks.keys.contains { wallpaper(settings.wallpaper(for: $0))?.manifest.interactive == true }
        if settings.followCursor && interactive {
            pointer.start()
        } else {
            pointer.stop()
            for desk in desktop.desks.values { desk.host.pointer(x: -1, y: -1, active: false) }
            pointerDisplay = nil
        }
    }

    private func forwardPointer(_ point: NSPoint) {
        let hit = desktop.locate(point)
        if let previous = pointerDisplay, previous != hit?.id {
            desktop.desks[previous]?.host.pointer(x: -1, y: -1, active: false)
        }
        pointerDisplay = hit?.id
        guard let hit, let desk = desktop.desks[hit.id],
              wallpaper(settings.wallpaper(for: hit.id))?.manifest.interactive == true else { return }
        desk.host.pointer(x: hit.x, y: hit.y, active: true)
    }

    /// Only on bare desktop: a click in a window or on the Dock is not for the koi.
    private func forwardClick(_ point: NSPoint) {
        guard let hit = desktop.locate(point), let desk = desktop.desks[hit.id],
              wallpaper(settings.wallpaper(for: hit.id))?.manifest.interactive == true,
              DesktopHitTest.isBareDesktop(point) else { return }
        desk.host.click(x: hit.x, y: hit.y)
    }

    /// Only restarts the countdown when the interval itself changes, so
    /// tweaking a slider doesn't keep pushing the next scene away.
    private func scheduleRotation() {
        guard settings.rotateMinutes != scheduledMinutes else { return }
        scheduledMinutes = settings.rotateMinutes
        rotationTimer?.invalidate()
        rotationTimer = nil
        guard settings.rotateMinutes > 0 else { return }
        let interval = TimeInterval(settings.rotateMinutes * 60)
        rotationTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.showNext() }
        }
    }
}
