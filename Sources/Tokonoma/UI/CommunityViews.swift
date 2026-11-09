import SwiftUI
import TokonomaCore

private let byteFormat: ByteCountFormatter = {
    let f = ByteCountFormatter()
    f.countStyle = .file
    return f
}()

/// The standing reminder on a community wallpaper: who made it, and what
/// "checked" does and doesn't mean.
struct CommunityNote: View {
    let origin: Origin

    var body: some View {
        VStack(alignment: .leading, spacing: Space.s) {
            HStack(spacing: Space.s) {
                Image(systemName: "person.2").font(Face.icon).foregroundStyle(Ink.secondary)
                Text("Community wallpaper by \(origin.author)").font(Face.label).foregroundStyle(Ink.text)
            }
            Text("Made by someone else, not by Tokonoma. It passed the automatic checks and runs with no network and no access outside its own folder, but nobody has reviewed it by hand.")
                .font(Face.body)
                .foregroundStyle(Ink.secondary)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: Space.xs) {
                if let bytes = origin.packageBytes { fact("size", byteFormat.string(fromByteCount: Int64(bytes))) }
                if let grid = origin.grid { fact("grid", grid) }
                fact("installed", origin.installedAt.formatted(date: .abbreviated, time: .omitted))
                if let url = origin.authorURL { fact("author", url) }
            }
        }
        .padding(Space.l)
        .background(RoundedRectangle(cornerRadius: Radius.panel, style: .continuous).fill(Ink.card))
        .overlay(RoundedRectangle(cornerRadius: Radius.panel, style: .continuous).strokeBorder(Ink.hairline))
    }

    private func fact(_ label: String, _ value: String) -> some View {
        FactRow(label: label, value: value)
    }
}

/// Shown before anything from outside is installed. Install is never the default.
struct InstallSheet: View {
    let pending: PendingInstall
    let install: () -> Void
    let cancel: () -> Void

    private var facts: ValidationReport.Facts { pending.report.facts }

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xl) {
            VStack(alignment: .leading, spacing: Space.s) {
                Text(pending.replaces ? "Update “\(pending.package.name)”?" : "Install “\(pending.package.name)”?")
                    .font(Face.title)
                    .foregroundStyle(Ink.text)
                Text("by \(pending.package.author)").font(Face.meta).foregroundStyle(Ink.secondary)
            }

            HStack(alignment: .top, spacing: Space.m) {
                Image(systemName: "exclamationmark.triangle").font(Face.icon).foregroundStyle(Ink.secondary)
                Text("This wallpaper comes from a third party, not from Tokonoma. It passed every automatic check on this Mac and will run with no network and no access outside its own folder, but nobody has reviewed it by hand. Only install wallpapers from people you trust.")
                    .font(Face.body)
                    .foregroundStyle(Ink.text)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(Space.l)
            .background(RoundedRectangle(cornerRadius: Radius.panel, style: .continuous).fill(Ink.raised))

            VStack(alignment: .leading, spacing: Space.xs) {
                fact("made by", [pending.package.author, pending.package.authorURL].compactMap { $0 }.joined(separator: " · "))
                fact("size", byteFormat.string(fromByteCount: Int64(facts.packageBytes)))
                if let media = facts.media {
                    fact("kind", "\(media.type), always woven, no code")
                    fact("dimensions", "\(media.width)×\(media.height)" + (media.seconds.map { String(format: " · %.0f s, silent", $0) } ?? ""))
                    fact("checks", "passed: nothing explicit, on theme, light")
                } else {
                    fact("grid", facts.grid)
                    fact("files", "\(facts.files) · scene \(byteFormat.string(fromByteCount: Int64(facts.sceneBytes)))")
                    fact("images", facts.assets.isEmpty ? "none" : facts.assets.map { "\($0.width)×\($0.height)" }.joined(separator: ", "))
                    fact("reacts to", facts.interactive ? "cursor and clicks" : "nothing, it just plays")
                    fact("checks", "passed: no network, own files only, nothing explicit, on theme, light")
                }
                fact("fingerprint", String(pending.package.sha256.prefix(16)))
            }

            HStack(spacing: Space.s) {
                Spacer()
                Button("Cancel", action: cancel)
                    .buttonStyle(QuietButtonStyle())
                    .keyboardShortcut(.cancelAction)
                Button(pending.replaces ? "Update" : "Install", action: install)
                    .buttonStyle(PrimaryButtonStyle())
            }
        }
        .padding(Space.xl)
        .frame(width: 480)
        .background(Ink.page)
        .preferredColorScheme(.dark)
    }

    private func fact(_ label: String, _ value: String) -> some View {
        FactRow(label: label, value: value)
    }
}
