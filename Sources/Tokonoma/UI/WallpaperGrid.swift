import SwiftUI
import TokonomaCore

enum LibraryFilter: String, CaseIterable {
    case all, favourites
}

struct WallpaperGrid: View {
    @EnvironmentObject private var model: AppModel
    @Binding var selection: String?
    /// The Chinese tab: only tagged scenes, no filter bar. The Library tab leaves them out.
    var onlyChinese = false
    // A per-window convenience, so it lives in defaults rather than settings.json.
    @AppStorage("libraryFilter") private var filter = LibraryFilter.all.rawValue

    @FocusState private var focused: Bool
    @State private var width: CGFloat = 0

    private static let minimumCell: CGFloat = 200
    private let columns = [GridItem(.adaptive(minimum: minimumCell, maximum: 280), spacing: Space.xl, alignment: .top)]

    var body: some View {
        ScrollViewReader { proxy in
            VStack(alignment: .leading, spacing: Space.xl) {
                if onlyChinese {
                    chinese
                } else {
                    ChoiceBar(options: LibraryFilter.allCases.map(\.rawValue), selection: $filter)
                        .fixedSize()
                    if filter == LibraryFilter.favourites.rawValue { favouritesOnly } else { everything }
                }
            }
            .background(GeometryReader { geo in
                Color.clear
                    .onAppear { width = geo.size.width }
                    .onChange(of: geo.size.width) { _, new in width = new }
            })
            // Arrow keys only move the highlight. Hanging stays a double click or the button.
            .focusable()
            .focusEffectDisabled()
            .focused($focused)
            .onAppear { focused = true }
            .onKeyPress(phases: [.down, .repeat]) { press in
                // Arrow keys arrive flagged as numeric pad; only a real modifier should stop the move.
                guard press.modifiers.isDisjoint(with: [.command, .option, .control, .shift]), let direction = Self.direction(press.key),
                      let id = GridNavigation.move(direction, from: selection, in: navigable.map { $0.map(\.id) }, columns: columnCount)
                else { return .ignored }
                selection = id
                proxy.scrollTo(id)
                return .handled
            }
        }
    }

    private static func direction(_ key: KeyEquivalent) -> GridNavigation.Direction? {
        switch key {
        case .leftArrow: return .left
        case .rightArrow: return .right
        case .upArrow: return .up
        case .downArrow: return .down
        default: return nil
        }
    }

    private var columnCount: Int {
        max(1, Int((width + Space.xl) / (Self.minimumCell + Space.xl)))
    }

    /// What is on screen, section by section, in reading order.
    private var navigable: [[Wallpaper]] {
        if onlyChinese { return [WallpaperShelf.chinese(model.wallpapers)] }
        if filter == LibraryFilter.favourites.rawValue { return [model.favourites] }
        let rest = WallpaperShelf.withoutChinese(model.wallpapers)
        return [rest.filter(\.isBuiltIn), rest.filter(\.isCommunity), rest.filter { !$0.isBuiltIn && !$0.isCommunity }]
    }

    @ViewBuilder private var chinese: some View {
        let items = WallpaperShelf.chinese(model.wallpapers)
        if items.isEmpty {
            VStack(alignment: .leading, spacing: Space.s) {
                SectionTitle("Chinese")
                Text("Nothing here yet. Scenes drawn from Chinese places and seasons will gather in this tab")
                    .font(Face.body)
                    .foregroundStyle(Ink.muted)
            }
        } else {
            section("Chinese", items)
        }
    }

    @ViewBuilder private var favouritesOnly: some View {
        let starred = model.favourites
        if starred.isEmpty {
            VStack(alignment: .leading, spacing: Space.s) {
                SectionTitle("Favourites")
                Text("Star a scene to keep it here. Your favourites are what the menu bar lists, and what Next steps through")
                    .font(Face.body)
                    .foregroundStyle(Ink.muted)
            }
        } else {
            section("Favourites", starred)
        }
    }

    private var everything: some View {
        let rest = WallpaperShelf.withoutChinese(model.wallpapers)
        return VStack(alignment: .leading, spacing: Space.xxl) {
            section("Scenes", rest.filter(\.isBuiltIn))
            let community = rest.filter(\.isCommunity)
            if !community.isEmpty { section("Community", community) }
            let yours = rest.filter { !$0.isBuiltIn && !$0.isCommunity }
            if yours.isEmpty {
                VStack(alignment: .leading, spacing: Space.s) {
                    SectionTitle("Yours")
                    Text("Drop a video, gif or picture here and it gets woven like the scenes above. Wallpaper packages (.tokonoma) go here too")
                        .font(Face.body)
                        .foregroundStyle(Ink.muted)
                }
            } else {
                section("Yours", yours)
            }
        }
    }

    private func section(_ title: String, _ items: [Wallpaper]) -> some View {
        VStack(alignment: .leading, spacing: Space.m) {
            HStack(spacing: Space.s) {
                SectionTitle(title)
                Text("\(items.count)").font(Face.meta).foregroundStyle(Ink.muted).monospacedDigit()
            }
            LazyVGrid(columns: columns, alignment: .leading, spacing: Space.xl) {
                ForEach(items) { wallpaper in
                    WallpaperCard(
                        wallpaper: wallpaper,
                        image: model.thumbnails[wallpaper.id],
                        selected: selection == wallpaper.id,
                        hanging: model.isShownAnywhere(wallpaper.id),
                        favourite: model.settings.isFavourite(wallpaper.id),
                        toggleFavourite: { model.toggleFavourite(wallpaper.id) }
                    )
                    .id(wallpaper.id)
                    .onTapGesture {
                        selection = wallpaper.id
                        focused = true
                        // AppKit's count follows the system double-click speed. SwiftUI's
                        // count: 2 gives up after about 300 ms and misses ordinary double clicks.
                        if (NSApp.currentEvent?.clickCount ?? 1) >= 2 { model.show(wallpaper.id) }
                    }
                    .contextMenu {
                        Button("Hang") { model.show(wallpaper.id) }
                        Button(model.settings.isFavourite(wallpaper.id) ? "Remove from favourites" : "Add to favourites") {
                            model.toggleFavourite(wallpaper.id)
                        }
                    }
                }
            }
        }
    }
}

struct WallpaperCard: View {
    let wallpaper: Wallpaper
    let image: NSImage?
    let selected: Bool
    let hanging: Bool
    let favourite: Bool
    let toggleFavourite: () -> Void
    @State private var hovering = false

    var body: some View {
        VStack(alignment: .leading, spacing: Space.s) {
            ZStack {
                Ink.card
                if let image {
                    Image(nsImage: image).resizable().interpolation(.high).aspectRatio(contentMode: .fill)
                } else {
                    Text(wallpaper.manifest.title ?? "…")
                        .font(Face.kanji(20))
                        .foregroundStyle(Ink.muted)
                }
            }
            .aspectRatio(16 / 10, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: Radius.thumb, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.thumb, style: .continuous)
                    .strokeBorder(selected ? Ink.ring : (hovering ? Ink.hairlineStrong : Ink.hairline), lineWidth: 1)
            )
            .overlay(alignment: .topTrailing) {
                if favourite || hovering { StarButton(on: favourite, action: toggleFavourite).padding(Space.s) }
            }
            .padding(Space.xs)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.thumb + Space.xs, style: .continuous)
                    .strokeBorder(selected ? Ink.ring : .clear, lineWidth: 1)
            )

            HStack(spacing: Space.s) {
                Text(wallpaper.name).font(Face.label).foregroundStyle(Ink.text).lineLimit(1)
                if let title = wallpaper.manifest.title {
                    Text(title).font(Face.kanji(12)).foregroundStyle(Ink.muted)
                }
                Spacer(minLength: 0)
                if hanging { Seal() }
            }
            .padding(.horizontal, Space.xs)
            if let origin = wallpaper.origin {
                Text("by \(origin.author)").font(Face.meta).foregroundStyle(Ink.muted).lineLimit(1).padding(.horizontal, Space.xs)
            }
        }
        .contentShape(Rectangle())
        .onHover { inside in withAnimation(Motion.quick) { hovering = inside } }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
        .accessibilityAction(named: favourite ? "Remove from favourites" : "Add to favourites", toggleFavourite)
    }
}

/// Shu when starred (it means "on"), a quiet outline while hovering otherwise.
struct StarButton: View {
    let on: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: on ? "star.fill" : "star")
                .font(Face.icon.weight(.medium))
                .foregroundStyle(on ? Ink.shu : Ink.text)
                .frame(width: 24, height: 24)
                .background(Circle().fill(Ink.deepest.opacity(0.75)))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .help(on ? "Remove from favourites" : "Add to favourites")
    }
}
