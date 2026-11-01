import SwiftUI
import TokonomaCore

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var openAtLogin = LaunchAtLogin.isEnabled

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xxl) {
                group("Rest when nobody's looking") {
                    toggleRow("Behind full-screen and maximised windows", \.pauseWhenCovered)
                    toggleRow("In Low Power Mode", \.pauseInLowPower)
                    toggleRow("Whenever the Mac is on battery", \.pauseOnBattery)
                }
                group("Smoothness") {
                    pickerRow("Frames per second", \.fpsCap, [15, 24, 30, 60], format: { "\($0)" })
                    pickerRow("On battery", \.batteryFps, [10, 15, 24, 30], format: { "\($0)" })
                        .disabled(model.settings.pauseOnBattery)
                }
                group("Change the scroll") {
                    pickerRow("Next scene every", \.rotateMinutes, [0, 15, 60, 360, 1440], format: rotation)
                }
                group("Cursor") {
                    toggleRow("Let scenes react to the cursor and clicks", \.followCursor)
                }
                group("Displays") {
                    if model.displays.isEmpty {
                        Text("No displays found").font(Face.body).foregroundStyle(Ink.muted)
                    }
                    ForEach(model.displays) { display in
                        HStack {
                            Text(display.name).font(Face.body).foregroundStyle(Ink.secondary)
                            Spacer()
                            Picker("", selection: Binding(
                                get: { model.shown(on: display.id) },
                                set: { model.show($0, on: display.id) }
                            )) {
                                ForEach(model.wallpapers) { Text($0.name).tag($0.id) }
                            }
                            .labelsHidden()
                            .controlSize(.small)
                            .fixedSize()
                        }
                        .frame(minHeight: 36)
                    }
                }
                group("Startup") {
                    HStack {
                        Text("Open at login").font(Face.body).foregroundStyle(Ink.secondary)
                        Spacer()
                        Toggle("", isOn: $openAtLogin)
                            .toggleStyle(.switch)
                            .controlSize(.mini)
                            .labelsHidden()
                            .onChange(of: openAtLogin) { _, wanted in
                                if let problem = LaunchAtLogin.set(wanted) {
                                    model.notice = problem
                                    openAtLogin = LaunchAtLogin.isEnabled
                                }
                            }
                    }
                    .frame(minHeight: 36)
                }
                Text("Library folder  \(model.paths.library.path)")
                    .font(Face.meta)
                    .foregroundStyle(Ink.muted)
                    .textSelection(.enabled)
            }
            .frame(maxWidth: 560, alignment: .leading)
            .padding(Space.xxl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func group<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Space.s) {
            Text(title).font(Face.label).foregroundStyle(Ink.text)
            VStack(alignment: .leading, spacing: 2) { content() }
        }
    }

    private func toggleRow(_ label: String, _ key: WritableKeyPath<TokonomaCore.Settings, Bool>) -> some View {
        HStack {
            Text(label).font(Face.body).foregroundStyle(Ink.secondary)
            Spacer()
            Toggle("", isOn: Binding(
                get: { model.settings[keyPath: key] },
                set: { value in model.change { $0.with(key, value) } }
            ))
            .toggleStyle(.switch)
            .controlSize(.mini)
            .labelsHidden()
        }
        .frame(minHeight: 36)
    }

    private func pickerRow(_ label: String, _ key: WritableKeyPath<TokonomaCore.Settings, Int>, _ options: [Int], format: @escaping (Int) -> String) -> some View {
        HStack {
            Text(label).font(Face.body).foregroundStyle(Ink.secondary)
            Spacer()
            Picker("", selection: Binding(
                get: { model.settings[keyPath: key] },
                set: { value in model.change { $0.with(key, value) } }
            )) {
                ForEach(options, id: \.self) { Text(format($0)).tag($0) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .controlSize(.small)
            .fixedSize()
        }
        .frame(minHeight: 36)
    }

    private func rotation(_ minutes: Int) -> String {
        switch minutes {
        case 0: "never"
        case 1440: "day"
        case let m where m >= 60: "\(m / 60)h"
        default: "\(minutes)m"
        }
    }
}
