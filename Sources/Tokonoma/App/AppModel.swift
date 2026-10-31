import AppKit
import Combine
import TokonomaCore

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

    static let builtInOrder = ["torii", "koi", "sumi", "fuji"]

    let paths: Paths
    let isFirstRun: Bool
    private let store: SettingsStore
    private let desktop = DesktopController()
    private let monitor = SystemMonitor()
    private let pointer = PointerTracker()
    private var builtIns: [String] = []
    private var rotationTimer: Timer?
    private var pointerDisplay: String?
    private lazy var thumbnailer = Thumbnailer(paths: paths) { [weak self] id, image in
        self?.thumbnails[id] = image
    }

    init(paths: Paths = .standard()) {
        self.paths = paths
        store = SettingsStore(url: paths.settings)
        isFirstRun = !FileManager.default.fileExists(atPath: paths.settings.path)
        settings = store.load()
    }

    func start() {
        do {
            builtIns = try BundleSync.install(from: paths.bundledWallpapers, into: paths.library)
        } catch {
            NSLog("tokonoma: could not install built-in wallpapers: \(error)")
            notice = "The built-in wallpapers couldn't be copied into your library. \(error.localizedDescription)"
        }
        rescan()
        desktop.onChange = { [weak self] in self?.refreshDesks() }
        desktop.onError = { [weak self] message in self?.notice = "A wallpaper hit a problem: \(message)" }
        monitor.onChange = { [weak self] _ in self?.refreshPlayback() }
        pointer.onMove = { [weak self] point in self?.forwardPointer(point) }
        monitor.start()
        desktop.syncScreens()
        followCursorIfUseful()
        scheduleRotation()
        thumbnailer.render(wallpapers)
    }

    func stop() {
        pointer.stop()
        desktop.tearDown()
    }

    // MARK: - Reading

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

    func showNext() {
        guard let next = Rotation.next(after: settings.fallbackWallpaper, in: wallpapers.map(\.id)) else { return }
        show(next)
    }

    @discardableResult
    func importFiles(_ urls: [URL]) -> [String] {
        guard let template = try? String(contentsOf: paths.mediaTemplate, encoding: .utf8) else {
            notice = ImportError.badTemplate.description
            return []
        }
        var added: [String] = []
        var failures: [String] = []
        for url in urls {
            do {
                let wallpaper = try MediaImporter.importMedia(from: url, into: paths.library, template: template)
                added.append(wallpaper.id)
            } catch let error as ImportError {
                failures.append("\(url.lastPathComponent): \(error.description)")
            } catch {
                failures.append("\(url.lastPathComponent): \(error.localizedDescription)")
            }
        }
        rescan()
        thumbnailer.render(wallpapers.filter { added.contains($0.id) })
        if !failures.isEmpty { notice = failures.joined(separator: "\n") }
        return added
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
        do {
            try store.save(next)
        } catch {
            notice = "Your settings couldn't be saved: \(error.localizedDescription)"
        }
        refreshDesks()
        followCursorIfUseful()
        scheduleRotation()
    }

    private func refreshDesks() {
        displays = desktop.desks.map { DisplayInfo(id: $0.key, name: $0.value.name) }.sorted { $0.name < $1.name }
        for (display, desk) in desktop.desks {
            guard let wallpaper = wallpaper(settings.wallpaper(for: display)) ?? wallpapers.first else { continue }
            let props = properties(for: wallpaper)
            if desk.host.wallpaperID == wallpaper.id {
                desk.host.apply(props)
            } else {
                desk.host.load(wallpaper, properties: props, root: paths.library)
            }
        }
        refreshPlayback()
    }

    private func refreshPlayback() {
        var next: [String: Playback] = [:]
        for (display, desk) in desktop.desks {
            let decision = PlaybackPolicy.decide(monitor.conditions.with(\.covered, desk.window.isCovered), settings)
            next[display] = decision
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
        if settings.followCursor && interactive { pointer.start() } else { pointer.stop() }
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

    private func scheduleRotation() {
        rotationTimer?.invalidate()
        rotationTimer = nil
        guard settings.rotateMinutes > 0 else { return }
        let interval = TimeInterval(settings.rotateMinutes * 60)
        rotationTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.showNext() }
        }
    }
}
