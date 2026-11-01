import SwiftUI
import TokonomaCore

/// One adjustable setting from a wallpaper's manifest, drawn with the shared controls.
struct PropertyRow: View {
    let spec: PropertySpec
    let value: PropertyValue
    let onChange: (PropertyValue) -> Void

    var body: some View {
        SettingRow(label: spec.label.sentenceCased) { control }
    }

    @ViewBuilder private var control: some View {
        switch spec.kind {
        case .range: range
        case .choice: choice
        case .toggle: toggle
        case .color: colour
        }
    }

    private var range: some View {
        let lo = spec.min ?? 0
        let hi = Swift.max(spec.max ?? 1, lo)
        let binding = Binding<Double>(
            get: { value.number ?? lo },
            set: { onChange(.number($0)) }
        )
        return HStack(spacing: Space.m) {
            // No `step:` here: macOS would draw a tick for every step. The model snaps instead.
            Slider(value: binding, in: lo...hi)
                .controlSize(.small)
                .tint(Ink.shu)
                .frame(width: 140)
            Text(format(binding.wrappedValue))
                .font(Face.meta)
                .monospacedDigit()
                .foregroundStyle(Ink.muted)
                .frame(width: 32, alignment: .trailing)
        }
    }

    @ViewBuilder private var choice: some View {
        let options = spec.options ?? []
        let binding = Binding<String>(get: { value.text ?? "" }, set: { onChange(.text($0)) })
        if options.count <= 4 {
            ChoiceBar(options: options, selection: binding)
        } else {
            MenuChoice(options: options, selection: binding)
        }
    }

    private var toggle: some View {
        Toggle("", isOn: Binding(get: { value.flag ?? false }, set: { onChange(.flag($0)) }))
            .toggleStyle(ShuToggleStyle())
            .labelsHidden()
    }

    private var colour: some View {
        ColorPicker("", selection: Binding(
            get: { Color(hexString: value.text ?? "#000000") },
            set: { onChange(.text($0.hexString)) }
        ), supportsOpacity: false)
        .labelsHidden()
    }

    private func format(_ n: Double) -> String {
        let step = spec.step ?? 0.01
        return step >= 1 ? String(format: "%.0f", n) : String(format: "%.1f", n)
    }
}

extension Color {
    init(hexString: String) {
        let hex = hexString.hasPrefix("#") ? String(hexString.dropFirst()) : hexString
        let full = hex.count == 3 ? hex.map { "\($0)\($0)" }.joined() : hex
        self.init(hex: UInt32(full, radix: 16) ?? 0)
    }

    var hexString: String {
        let ns = NSColor(self).usingColorSpace(.sRGB) ?? .black
        return String(format: "#%02x%02x%02x", Int(ns.redComponent * 255), Int(ns.greenComponent * 255), Int(ns.blueComponent * 255))
    }
}
