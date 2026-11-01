import AppKit
import IOKit.ps
import TokonomaCore

/// Watches battery, Low Power Mode, display sleep and screen lock, and
/// reports a fresh `Conditions` whenever any of them change.
@MainActor
final class SystemMonitor {
    private(set) var conditions = Conditions.idle
    var onChange: ((Conditions) -> Void)?
    private var observers: [(NotificationCenter, NSObjectProtocol)] = []
    private var batteryTimer: Timer?

    func start() {
        let workspace = NSWorkspace.shared.notificationCenter
        let distributed = DistributedNotificationCenter.default()
        watch(workspace, NSWorkspace.screensDidSleepNotification) { $0.with(\.screensAsleep, true) }
        watch(workspace, NSWorkspace.screensDidWakeNotification) { $0.with(\.screensAsleep, false) }
        watch(workspace, NSWorkspace.sessionDidResignActiveNotification) { $0.with(\.sessionActive, false) }
        watch(workspace, NSWorkspace.sessionDidBecomeActiveNotification) { $0.with(\.sessionActive, true) }
        watch(distributed, Notification.Name("com.apple.screenIsLocked")) { $0.with(\.sessionActive, false) }
        watch(distributed, Notification.Name("com.apple.screenIsUnlocked")) { $0.with(\.sessionActive, true) }
        watch(.default, .NSProcessInfoPowerStateDidChange) { $0.with(\.lowPower, ProcessInfo.processInfo.isLowPowerModeEnabled) }
        watch(.default, ProcessInfo.thermalStateDidChangeNotification) { $0.with(\.thermal, Self.thermal()) }

        update {
            $0.with(\.lowPower, ProcessInfo.processInfo.isLowPowerModeEnabled)
                .with(\.onBattery, Self.onBattery())
                .with(\.thermal, Self.thermal())
        }
        // Power-source callbacks need a C trampoline; a slow poll is plenty for this.
        batteryTimer = Timer.scheduledTimer(withTimeInterval: 20, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.update { $0.with(\.onBattery, Self.onBattery()) } }
        }
    }

    private func watch(_ center: NotificationCenter, _ name: Notification.Name, _ change: @escaping (Conditions) -> Conditions) {
        let token = center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.update(change) }
        }
        observers.append((center, token))
    }

    private func update(_ change: (Conditions) -> Conditions) {
        let next = change(conditions)
        guard next != conditions else { return }
        conditions = next
        onChange?(next)
    }

    static func thermal() -> Conditions.Thermal {
        switch ProcessInfo.processInfo.thermalState {
        case .nominal: .nominal
        case .fair: .fair
        case .serious: .serious
        case .critical: .critical
        @unknown default: .serious
        }
    }

    static func onBattery() -> Bool {
        guard let info = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
              let type = IOPSGetProvidingPowerSourceType(info)?.takeUnretainedValue() as String?
        else { return false }
        return type == kIOPMBatteryPowerKey
    }
}
