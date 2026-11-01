import SwiftUI
import TokonomaCore

struct WallpaperGrid: View {
    @EnvironmentObject private var model: AppModel
    @Binding var selection: String?

    private let columns = [GridItem(.adaptive(minimum: 200, maximum: 280), spacing: Space.xl, alignment: .top)]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xxl) {
            section("Scenes", model.wallpapers.filter(\.isBuiltIn))
            let community = model.wallpapers.filter(\.isCommunity)
            if !community.isEmpty { section("Community", community) }
            let yours = model.wallpapers.filter { !$0.isBuiltIn && !$0.isCommunity }
            if yours.isEmpty {
                VStack(alignment: .leading, spacing: Space.s) {
                    Text("Yours").font(Face.label).foregroundStyle(Ink.secondary)
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
                Text(title).font(Face.label).foregroundStyle(Ink.secondary)
                Text("\(items.count)").font(Face.meta).foregroundStyle(Ink.muted).monospacedDigit()
            }
            LazyVGrid(columns: columns, alignment: .leading, spacing: Space.xl) {
                ForEach(items) { wallpaper in
                    WallpaperCard(
                        wallpaper: wallpaper,
                        image: model.thumbnails[wallpaper.id],
                        selected: selection == wallpaper.id,
                        hanging: model.isShownAnywhere(wallpaper.id)
                    )
                    .onTapGesture { selection = wallpaper.id }
                    .onTapGesture(count: 2) { model.show(wallpaper.id) }
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
                    .strokeBorder(selected ? Ink.ring : (hovering ? Ink.hairline.opacity(2) : Ink.hairline), lineWidth: 1)
            )
            .padding(3)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.thumb + 3, style: .continuous)
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
            .padding(.horizontal, 3)
            if let origin = wallpaper.origin {
                Text("by \(origin.author)").font(Face.meta).foregroundStyle(Ink.muted).lineLimit(1).padding(.horizontal, 3)
            }
        }
        .contentShape(Rectangle())
        .onHover { inside in withAnimation(Motion.quick) { hovering = inside } }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
    }
}
