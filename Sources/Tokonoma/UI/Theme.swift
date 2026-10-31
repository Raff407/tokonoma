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
    /// Fill for switches, sliders and pickers: washi grey instead of system blue.
    static let control = Color(hex: 0xB9B2A6)
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
