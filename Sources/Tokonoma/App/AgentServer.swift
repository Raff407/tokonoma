import Foundation

/// Runs the bundled MCP server over HTTP so URL-based agents (ChatGPT and
/// friends) can design wallpapers. stdio agents launch it themselves; this is
/// only for the ones that need an address. Localhost only, behind a key.
@MainActor
final class AgentServer: ObservableObject {
    static let port = 7428

    @Published private(set) var running = false
    @Published private(set) var problem: String?
    private var process: Process?
    private let script: URL

    init(script: URL) {
        self.script = script
    }

    /// Node isn't part of macOS; look where installers usually put it.
    static func findNode() -> URL? {
        let candidates = ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"]
            + (ProcessInfo.processInfo.environment["PATH"] ?? "").split(separator: ":").map { "\($0)/node" }
        return candidates.map(URL.init(fileURLWithPath:)).first { FileManager.default.isExecutableFile(atPath: $0.path) }
    }

    var nodePath: String { Self.findNode()?.path ?? "node" }
    var scriptPath: String { script.path }

    var token: String? {
        let file = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Tokonoma/agent-token")
        return (try? String(contentsOf: file, encoding: .utf8))?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var url: String {
        "http://127.0.0.1:\(Self.port)/mcp" + (token.map { "?key=\($0)" } ?? "")
    }

    func start() {
        guard process == nil else { return }
        guard let node = Self.findNode() else {
            problem = "Agents need Node.js to connect. Install it from nodejs.org or with Homebrew, then try again."
            return
        }
        let child = Process()
        child.executableURL = node
        child.arguments = [script.path, "--http", String(Self.port)]
        child.standardOutput = FileHandle.nullDevice
        child.standardError = FileHandle.nullDevice
        child.terminationHandler = { [weak self] proc in
            Task { @MainActor in
                guard let self else { return }
                self.running = false
                self.process = nil
                if proc.terminationStatus != 0 && proc.terminationReason != .uncaughtSignal {
                    self.problem = "The agent server stopped (port \(Self.port) may be in use)."
                }
            }
        }
        do {
            try child.run()
            process = child
            running = true
            problem = nil
        } catch {
            problem = "The agent server couldn't start: \(error.localizedDescription)"
        }
    }

    func stop() {
        process?.terminate()
        process = nil
        running = false
    }
}
