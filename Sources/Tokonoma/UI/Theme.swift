import SwiftUI

/*
 * Direction
 *   Product    A free live-wallpaper host for macOS: one woven scene hangs behind your icons
 *   Character  quiet, exact, a little ceremonial
 *   World      a tokonoma alcove at night: sumi ink, lacquer, washi
 *   Moment     the live preview of the selected scene; everything around it stays graphite
 *   Signature  a small vermilion hanko seal on whatever is hanging right now
 */
enum Ink {
    static let deepest = Color(hex: 0x12110F)
    static let page = Color(hex: 0x161513)
    static let card = Color(hex: 0x1C1A18)
    static let raised = Color(hex: 0x262421)
    static let text = Color(hex: 0xEFE9DE)
    static let secondary = Color(hex: 0xAAA398)
    static let muted = Color(hex: 0x8A847A)
    static let hairline = Color(hex: 0xEFE9DE).opacity(0.08)
    static let ring = Color(hex: 0xEFE9DE).opacity(0.28)
    /// A hovered or selected card's edge: the hairline, one step louder.
    static let hairlineStrong = Color(hex: 0xEFE9DE).opacity(0.16)
    /// Controls that can't be used right now.
    static let disabled = 0.5
    /// The chosen option in a ChoiceBar: one step up from raised, still neutral.
    static let selected = Color(hex: 0x37332E)
    /// Shu, the vermilion of torii and seals. Used for the seal and almost nothing else.
    static let shu = Color(hex: 0xD6452C)
}

enum Space {
    static let xs: CGFloat = 4
    static let s: CGFloat = 8
    static let m: CGFloat = 12
    static let l: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
}

enum Radius {
    static let control: CGFloat = 8
    static let thumb: CGFloat = 10
    static let panel: CGFloat = 14
}

enum Face {
    static let body = Font.system(size: 13)
    static let label = Font.system(size: 13, weight: .medium)
    static let meta = Font.system(size: 12, design: .monospaced)
    static let title = Font.system(size: 22, weight: .medium)
    static let brand = Font.system(size: 15, weight: .medium)
    /// Group titles above settings and sections: words, so SF Pro, quiet.
    static let section = Font.system(size: 13, weight: .medium)
    /// Every line icon in the chrome sits at one size.
    static let icon = Font.system(size: 12, weight: .regular)
    /// Mincho for the kanji names only.
    static func kanji(_ size: CGFloat) -> Font { .custom("Hiragino Mincho ProN", size: size) }
}

enum Motion {
    static let quick = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.16)
    static let enter = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.36)
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

/// The hanko: a small square seal stamped on whatever hangs on the wall.
struct Seal: View {
    var size: CGFloat = 8

    var body: some View {
        RoundedRectangle(cornerRadius: 1.5, style: .continuous)
            .fill(Ink.shu)
            .frame(width: size, height: size)
            .accessibilityLabel("On the wall")
    }
}

/// Quiet secondary button: raised surface, hairline, primary text.
struct QuietButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Face.label)
            .foregroundStyle(Ink.text)
            .padding(.horizontal, Space.m)
            .frame(height: 28)
            .background(Ink.raised.opacity(configuration.isPressed ? 0.7 : 1), in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).strokeBorder(Ink.hairline))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(Motion.quick, value: configuration.isPressed)
    }
}

/// The one loud button per screen: off-white washi with sumi text.
struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Face.label)
            .foregroundStyle(Ink.deepest)
            .padding(.horizontal, Space.l)
            .frame(height: 32)
            .background(Ink.text.opacity(configuration.isPressed ? 0.85 : 1), in: RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(Motion.quick, value: configuration.isPressed)
    }
}

// MARK: - Controls
// Shu means "on": the seal, a switch that's on, a slider's filled track.
// Selection stays neutral. System blue never appears.

struct ShuToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle() } label: {
            ZStack(alignment: configuration.isOn ? .trailing : .leading) {
                Capsule(style: .continuous)
                    .fill(configuration.isOn ? Ink.shu : Ink.raised)
                    .overlay(Capsule(style: .continuous).strokeBorder(configuration.isOn ? .clear : Ink.hairline))
                Circle()
                    .fill(configuration.isOn ? Ink.text : Ink.muted)
                    .frame(width: 12, height: 12)
                    .padding(2)
            }
            .frame(width: 28, height: 16)
            .animation(Motion.quick, value: configuration.isOn)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isToggle)
        .accessibilityValue(configuration.isOn ? "On" : "Off")
    }
}

/// A row of options; the chosen one sits on a raised tile.
struct ChoiceBar: View {
    let options: [String]
    @Binding var selection: String
    var label: (String) -> String = { $0 }

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.self) { option in
                Button { selection = option } label: {
                    Text(label(option))
                        .font(Face.meta)
                        .foregroundStyle(option == selection ? Ink.text : Ink.muted)
                        .padding(.horizontal, Space.s)
                        .frame(height: 24)
                        .background(
                            RoundedRectangle(cornerRadius: Radius.control - 2, style: .continuous)
                                .fill(option == selection ? Ink.selected : .clear)
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .animation(Motion.quick, value: selection)
            }
        }
        .padding(2)
        .background(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).fill(Ink.deepest))
        .overlay(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).strokeBorder(Ink.hairline))
    }
}

/// For longer lists: shows the current value, opens a menu.
struct MenuChoice: View {
    let options: [String]
    @Binding var selection: String
    var label: (String) -> String = { $0 }

    var body: some View {
        Menu {
            ForEach(options, id: \.self) { option in
                Button(label(option)) { selection = option }
            }
        } label: {
            HStack(spacing: Space.xs) {
                Text(label(selection)).font(Face.meta).foregroundStyle(Ink.text)
                Image(systemName: "chevron.up.chevron.down").font(.system(size: 10, weight: .medium)).foregroundStyle(Ink.muted)
            }
            .padding(.horizontal, Space.s)
            .frame(height: 28)
            .background(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).fill(Ink.deepest))
            .overlay(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).strokeBorder(Ink.hairline))
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .fixedSize()
    }
}

/// Label on the left, control on the right, one height everywhere.
struct SettingRow<Control: View>: View {
    let label: String
    @ViewBuilder let control: Control

    var body: some View {
        HStack(spacing: Space.m) {
            Text(label)
                .font(Face.body)
                .foregroundStyle(Ink.secondary)
                .lineLimit(1)
            Spacer(minLength: Space.m)
            control
        }
        .frame(minHeight: 36)
    }
}

/// Text entry on the sunken surface, same height and hairline as the other controls.
struct InkField: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, Space.s)
            .frame(height: 28)
            .background(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).fill(Ink.deepest))
            .overlay(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).strokeBorder(Ink.hairline))
    }
}

extension View {
    func inkField() -> some View { modifier(InkField()) }
}

extension String {
    /// "time of day" → "Time of day": manifests write lowercase, the UI reads in sentence case.
    var sentenceCased: String { prefix(1).uppercased() + dropFirst() }
}

/// A group title above a run of rows: the same everywhere.
struct SectionTitle: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text).font(Face.section).foregroundStyle(Ink.secondary)
    }
}

/// One fact in a review list: a mono label column, then the value.
struct FactRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.m) {
            Text(label).font(Face.meta).foregroundStyle(Ink.muted).frame(width: 88, alignment: .leading)
            Text(value).font(Face.meta).foregroundStyle(Ink.secondary).textSelection(.enabled)
        }
    }
}
