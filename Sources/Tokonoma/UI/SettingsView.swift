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
                group("Battery") {
                    choiceRow("Frames per second", \.fpsCap, [15, 24, 30, 60], format: { "\($0)" })
                    choiceRow("On battery", \.batteryFps, [10, 15, 24, 30], format: { "\($0)" })
                        .disabled(model.settings.pauseOnBattery)
                        .opacity(model.settings.pauseOnBattery ? 0.5 : 1)
                    toggleRow("Keep glyphs Retina-sharp on battery", \.sharpOnBattery)
                }
                group("Change the scroll") {
                    choiceRow("Next scene every", \.rotateMinutes, [0, 15, 60, 360, 1440], format: rotation)
                }
                group("Cursor") {
                    toggleRow("Let scenes react to the cursor and clicks", \.followCursor)
                }
                group("Displays") {
                    if model.displays.isEmpty {
                        Text("No displays found").font(Face.body).foregroundStyle(Ink.muted)
                    }
                    ForEach(model.displays) { display in
                        SettingRow(label: display.name) {
                            MenuChoice(
                                options: model.wallpapers.map(\.id),
                                selection: Binding(get: { model.shown(on: display.id) }, set: { model.show($0, on: display.id) }),
                                label: { id in model.wallpaper(id)?.name ?? id }
                            )
                        }
                    }
                }
                group("Startup") {
                    SettingRow(label: "Open at login") {
                        Toggle("", isOn: $openAtLogin)
                            .toggleStyle(ShuToggleStyle())
                            .labelsHidden()
                            .onChange(of: openAtLogin) { _, wanted in
                                if let problem = LaunchAtLogin.set(wanted) {
                                    model.notice = problem
                                    openAtLogin = LaunchAtLogin.isEnabled
                                }
                            }
                    }
                }
                Text("library  \(model.paths.library.path)")
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
        SettingRow(label: label) {
            Toggle("", isOn: Binding(
                get: { model.settings[keyPath: key] },
                set: { value in model.change { $0.with(key, value) } }
            ))
            .toggleStyle(ShuToggleStyle())
            .labelsHidden()
        }
    }

    private func choiceRow(_ label: String, _ key: WritableKeyPath<TokonomaCore.Settings, Int>, _ options: [Int], format: @escaping (Int) -> String) -> some View {
        SettingRow(label: label) {
            ChoiceBar(
                options: options.map(String.init),
                selection: Binding(
                    get: { String(model.settings[keyPath: key]) },
                    set: { text in if let value = Int(text) { model.change { $0.with(key, value) } } }
                ),
                label: { format(Int($0) ?? 0) }
            )
        }
    }

    private func rotation(_ minutes: Int) -> String {
        switch minutes {
        case 0: "never"
        case 1440: "daily"
        case let m where m >= 60: "\(m / 60)h"
        default: "\(minutes)m"
        }
    }
}
