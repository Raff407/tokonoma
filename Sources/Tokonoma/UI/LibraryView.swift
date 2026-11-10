import SwiftUI
import TokonomaCore
import UniformTypeIdentifiers

enum Tab: String, CaseIterable {
    case library, chinese, market, agents, settings
}

/// The one window: a grid of scenes on the left, the chosen one alive on the right.
struct LibraryView: View {
    @EnvironmentObject private var model: AppModel
    @State private var tab: Tab = .library
    @State private var selection: String?
    @State private var dropping = false

    var body: some View {
        VStack(spacing: 0) {
            header
            if let notice = model.notice { NoticeBar(text: notice) { model.notice = nil } }
            Divider().overlay(Ink.hairline)
            switch tab {
            case .library: browser(onlyChinese: false)
            case .chinese: browser(onlyChinese: true)
            case .market: MarketView()
            case .agents: AgentsView(agents: model.agents)
            case .settings: SettingsView()
            }
        }
        .background(Ink.page)
        .tint(Ink.ring)
        .preferredColorScheme(.dark)
        .onAppear { if selection == nil { selection = model.settings.fallbackWallpaper } }
        .sheet(item: $model.pendingInstall) { pending in
            InstallSheet(pending: pending, install: {
                if let id = model.confirmInstall() { selection = id }
            }, cancel: { model.pendingInstall = nil })
        }
        .sheet(item: $model.shareDraft, onDismiss: { model.closeShare() }) { draft in
            ShareSheet(draft: draft)
        }
    }

    private var header: some View {
        HStack(spacing: Space.xl) {
            HStack(spacing: Space.s) {
                Text("Tokonoma").font(Face.brand).foregroundStyle(Ink.text)
                Text("床の間").font(Face.kanji(13)).foregroundStyle(Ink.muted)
            }
            .fixedSize()
            HStack(spacing: Space.l) {
                ForEach(Tab.allCases, id: \.self) { item in
                    Button { withAnimation(Motion.quick) { tab = item } } label: {
                        Text(item.rawValue.sentenceCased)
                            .font(Face.label)
                            .foregroundStyle(tab == item ? Ink.text : Ink.muted)
                    }
                    .buttonStyle(.plain)
                }
            }
            .fixedSize()
            Spacer(minLength: Space.m)
            Text(model.summary.lowercased())
                .font(Face.meta)
                .foregroundStyle(Ink.muted)
                .lineLimit(1)
                .truncationMode(.tail)
            Button(model.settings.userPaused ? "Resume" : "Pause") { model.togglePause() }
                .buttonStyle(QuietButtonStyle())
                .fixedSize()
            Button("Import…", action: chooseFiles)
                .buttonStyle(QuietButtonStyle())
                .fixedSize()
        }
        .padding(.leading, 84) // clear the traffic lights in the transparent title bar
        .padding(.trailing, Space.l)
        .frame(height: 52)
    }

    private func browser(onlyChinese: Bool) -> some View {
        HStack(spacing: 0) {
            ScrollView {
                WallpaperGrid(selection: $selection, onlyChinese: onlyChinese)
                    .padding(Space.xl)
            }
            .background(Ink.page)
            .overlay {
                if dropping {
                    RoundedRectangle(cornerRadius: Radius.panel, style: .continuous)
                        .strokeBorder(Ink.ring, style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                        .padding(Space.m)
                        .overlay(Text("Drop to add to your library").font(Face.label).foregroundStyle(Ink.secondary))
                        .background(Ink.page.opacity(0.85))
                }
            }
            .onDrop(of: [.fileURL], isTargeted: $dropping, perform: drop)

            Divider().overlay(Ink.hairline)

            Group {
                if let id = selection, let wallpaper = model.wallpaper(id) {
                    InspectorView(wallpaper: wallpaper) { selection = model.settings.fallbackWallpaper }
                        .id(wallpaper.id)
                } else {
                    Text("Pick a scene").font(Face.body).foregroundStyle(Ink.muted)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(width: 380)
            .background(Ink.deepest)
        }
    }

    private func chooseFiles() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.allowedContentTypes = (MediaImporter.acceptedExtensions + ["tokonoma"]).compactMap { UTType(filenameExtension: $0) }
        panel.message = "Videos, gifs, pictures or .tokonoma packages. Packages are checked before anything is installed"
        guard panel.runModal() == .OK else { return }
        let urls = panel.urls
        Task { if let first = await model.importFiles(urls).first { selection = first } }
    }

    private func drop(_ providers: [NSItemProvider]) -> Bool {
        let group = DispatchGroup()
        var urls: [URL] = []
        let lock = NSLock()
        for provider in providers {
            group.enter()
            _ = provider.loadObject(ofClass: URL.self) { url, _ in
                if let url {
                    lock.lock()
                    urls.append(url)
                    lock.unlock()
                }
                group.leave()
            }
        }
        group.notify(queue: .main) {
            Task { if let first = await model.importFiles(urls).first { selection = first } }
        }
        return true
    }
}

struct NoticeBar: View {
    let text: String
    var dismiss: (() -> Void)?
    /// Inline notices sit in a column of rounded panels; the window-wide one runs edge to edge.
    var inline = false

    var body: some View {
        HStack(alignment: .top, spacing: Space.m) {
            Image(systemName: "exclamationmark.circle")
                .font(Face.icon)
                .foregroundStyle(Ink.secondary)
            Text(text)
                .font(Face.body)
                .foregroundStyle(Ink.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .textSelection(.enabled)
            if let dismiss {
                Button("dismiss", action: dismiss).buttonStyle(.plain).font(Face.meta).foregroundStyle(Ink.muted)
            }
        }
        .padding(.horizontal, Space.l)
        .padding(.vertical, Space.m)
        .background(Ink.raised, in: RoundedRectangle(cornerRadius: inline ? Radius.panel : 0, style: .continuous))
    }
}
