import SwiftUI
import TokonomaCore

/// One adjustable setting: label on the left, its control on the right, 36pt tall.
struct PropertyRow: View {
    let spec: PropertySpec
    let value: PropertyValue
    let onChange: (PropertyValue) -> Void

    var body: some View {
        HStack(spacing: Space.m) {
            Text(spec.label)
                .font(Face.body)
                .foregroundStyle(Ink.secondary)
                .frame(width: 104, alignment: .leading)
                .lineLimit(1)
            control
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .frame(minHeight: 36)
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
        let hi = spec.max ?? 1
        let binding = Binding<Double>(
            get: { value.number ?? lo },
            set: { onChange(.number($0)) }
        )
        return HStack(spacing: Space.m) {
            // No `step:` here: macOS would draw a tick for every step. The model snaps instead.
            Slider(value: binding, in: lo...hi)
                .controlSize(.small)
            Text(format(binding.wrappedValue))
                .font(Face.meta)
                .monospacedDigit()
                .foregroundStyle(Ink.muted)
                .frame(width: 36, alignment: .trailing)
        }
    }

    @ViewBuilder private var choice: some View {
        let options = spec.options ?? []
        let binding = Binding<String>(get: { value.text ?? "" }, set: { onChange(.text($0)) })
        if options.count <= 4 {
            Picker("", selection: binding) {
                ForEach(options, id: \.self) { Text($0).tag($0) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .controlSize(.small)
        } else {
            Picker("", selection: binding) {
                ForEach(options, id: \.self) { Text($0).tag($0) }
            }
            .pickerStyle(.menu)
            .labelsHidden()
            .controlSize(.small)
            .fixedSize()
        }
    }

    private var toggle: some View {
        Toggle("", isOn: Binding(get: { value.flag ?? false }, set: { onChange(.flag($0)) }))
            .toggleStyle(.switch)
            .controlSize(.mini)
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
        return step >= 1 ? String(Int(n.rounded())) : String(format: "%.1f", n)
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
