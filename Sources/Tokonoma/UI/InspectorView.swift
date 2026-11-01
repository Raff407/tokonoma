import SwiftUI
import TokonomaCore

struct InspectorView: View {
    @EnvironmentObject private var model: AppModel
    let wallpaper: Wallpaper
    let onRemoved: () -> Void
    @State private var confirmRemove = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xl) {
                GeometryReader { box in
                    LivePreview(wallpaper: wallpaper, properties: model.properties(for: wallpaper), root: model.paths.library,
                                isolation: model.isolation(for: wallpaper), width: box.size.width)
                }
                    .aspectRatio(16 / 10, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.thumb, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Radius.thumb, style: .continuous).strokeBorder(Ink.hairline))

                heading
                if let origin = wallpaper.origin { CommunityNote(origin: origin) }
                actions
                if wallpaper.isMedia && !wallpaper.isBuiltIn && !wallpaper.isCommunity { sharing }
                if !wallpaper.manifest.properties.isEmpty { properties }
                if !wallpaper.isBuiltIn { removal }
            }
            .padding(Space.xl)
        }
        .confirmationDialog("Remove \(wallpaper.name)?", isPresented: $confirmRemove) {
            Button("Remove", role: .destructive) {
                model.remove(wallpaper.id)
                onRemoved()
            }
        } message: {
            Text("The copy in your Tokonoma library is deleted. The original file stays where it was.")
        }
    }

    private var heading: some View {
        VStack(alignment: .leading, spacing: Space.s) {
            HStack(alignment: .firstTextBaseline, spacing: Space.m) {
                Text(wallpaper.name).font(Face.title).foregroundStyle(Ink.text)
                if let title = wallpaper.manifest.title {
                    Text(title).font(Face.kanji(18)).foregroundStyle(Ink.secondary)
                }
                Spacer(minLength: 0)
                if model.isShownAnywhere(wallpaper.id) {
                    HStack(spacing: 6) {
                        Seal()
                        Text("on the wall").font(Face.meta).foregroundStyle(Ink.muted)
                    }
                }
            }
            if let description = wallpaper.manifest.description {
                Text(description)
                    .font(Face.body)
                    .foregroundStyle(Ink.secondary)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var everywhere: Bool {
        model.settings.assignments.isEmpty && model.settings.fallbackWallpaper == wallpaper.id
    }

    private var actions: some View {
        HStack(spacing: Space.s) {
            Button(everywhere ? "Hanging on every display" : "Hang on every display") { model.show(wallpaper.id) }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(everywhere)
                .opacity(everywhere ? 0.6 : 1)
            if model.displays.count > 1 {
                Menu {
                    ForEach(model.displays) { display in
                        Button {
                            model.show(wallpaper.id, on: display.id)
                        } label: {
                            if model.shown(on: display.id) == wallpaper.id {
                                Label(display.name, systemImage: "checkmark")
                            } else {
                                Text(display.name)
                            }
                        }
                    }
                } label: {
                    Text("One display")
                }
                .menuStyle(.button)
                .buttonStyle(QuietButtonStyle())
                .fixedSize()
            }
        }
    }

    /// Imports are private until you choose otherwise.
    private var sharing: some View {
        HStack(spacing: Space.s) {
            Button("Share to market…") { model.share(wallpaper) }
                .buttonStyle(QuietButtonStyle())
            if let listing = model.listing(for: wallpaper) {
                Text("in the market · v\(listing.version)").font(Face.meta).foregroundStyle(Ink.muted)
            } else {
                Text("private").font(Face.meta).foregroundStyle(Ink.muted)
            }
        }
    }

    private var properties: some View {
        VStack(alignment: .leading, spacing: Space.s) {
            HStack {
                Text("Adjust").font(Face.label).foregroundStyle(Ink.secondary)
                Spacer()
                if model.settings.overrides[wallpaper.id] != nil {
                    Button("Reset") { model.reset(wallpaper.id) }
                        .buttonStyle(.plain)
                        .font(Face.meta)
                        .foregroundStyle(Ink.muted)
                }
            }
            VStack(spacing: 2) {
                ForEach(wallpaper.manifest.properties, id: \.key) { spec in
                    PropertyRow(spec: spec, value: model.properties(for: wallpaper)[spec.key] ?? spec.defaultValue) { value in
                        model.set(spec.key, to: value, for: wallpaper.id)
                    }
                }
            }
        }
    }

    private var removal: some View {
        Button("Remove from library…") { confirmRemove = true }
            .buttonStyle(.plain)
            .font(Face.body)
            .foregroundStyle(Ink.muted)
    }
}

/// A live, interactive copy of the wallpaper; tweaks show up here and on the desktop at once.
struct LivePreview: NSViewRepresentable {
    let wallpaper: Wallpaper
    let properties: [String: PropertyValue]
    let root: URL
    let isolation: [String]?
    let width: CGFloat

    /// Lay the page out as if it were this many points wide, then shrink it to
    /// fit, so the preview is a miniature of the desktop rather than a close-up.
    static let virtualWidth: CGFloat = 1280

    func makeCoordinator() -> WallpaperHost { WallpaperHost() }

    func makeNSView(context: Context) -> NSView {
        let host = context.coordinator
        host.setFps(30)
        host.webView.pageZoom = zoom
        host.load(wallpaper, properties: properties, root: root, isolation: isolation)
        return host.webView
    }

    private var zoom: CGFloat { max(0.15, min(1, width / Self.virtualWidth)) }

    func updateNSView(_ view: NSView, context: Context) {
        let host = context.coordinator
        if abs(host.webView.pageZoom - zoom) > 0.001 { host.webView.pageZoom = zoom }
        if host.wallpaperID != wallpaper.id {
            host.load(wallpaper, properties: properties, root: root, isolation: isolation)
        } else {
            host.apply(properties)
        }
    }

    static func dismantleNSView(_ view: NSView, coordinator: WallpaperHost) {
        coordinator.setPaused(true)
    }
}
