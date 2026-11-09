import AppKit
import SwiftUI

/// How to plug an AI agent into Tokonoma so it can design wallpapers.
struct AgentsView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject var agents: AgentServer

    private var node: String { agents.nodePath }
    private var script: String { agents.scriptPath }

    var body: some View {
        ScrollView {
            // Words on the left, the snippets you copy on the right; stacked when the window is narrow.
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: Space.xxl) {
                    about.frame(width: 360, alignment: .leading)
                    // An ideal width, or ViewThatFits measures the long snippets on one line and never fits.
                    connect.frame(minWidth: 400, idealWidth: 480, maxWidth: 720, alignment: .leading)
                }
                .frame(minWidth: 900, alignment: .leading)
                VStack(alignment: .leading, spacing: Space.xxl) { about; connect }
                    .frame(maxWidth: 620, alignment: .leading)
            }
            .padding(Space.xxl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var about: some View {
        VStack(alignment: .leading, spacing: Space.xxl) {
            VStack(alignment: .leading, spacing: Space.s) {
                Text("Let an agent make wallpapers").font(Face.title).foregroundStyle(Ink.text)
                Text("Connect Claude, ChatGPT, Codex, Cursor or any agent that speaks MCP. It can read the house rules and the official scenes, start a wallpaper, check it, preview it, and send it here. Nothing an agent makes is installed until you say so in this window, with the same checks and warning as any community wallpaper.")
                    .font(Face.body)
                    .foregroundStyle(Ink.secondary)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if AgentServer.findNode() == nil {
                NoticeBar(text: "Agents need Node.js to run the Tokonoma tools. Install it from nodejs.org or with Homebrew (brew install node)", inline: true)
            }
            group("Try asking") {
                Text("“Read the Tokonoma rules and the koi scene, then make me a rainy bamboo forest wallpaper and send it to the app.”")
                    .font(Face.body)
                    .foregroundStyle(Ink.secondary)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var connect: some View {
        VStack(alignment: .leading, spacing: Space.xl) {
            group("Claude Code") {
                CodeBlock(text: "claude mcp add tokonoma -- \"\(node)\" \"\(script)\"")
            }
            group("Codex") {
                CodeBlock(text: "codex mcp add tokonoma -- \"\(node)\" \"\(script)\"")
            }
            group("Claude Desktop, Cursor and other config files") {
                CodeBlock(text: """
                {
                  "mcpServers": {
                    "tokonoma": { "command": "\(node)", "args": ["\(script)"] }
                  }
                }
                """)
            }
            group("ChatGPT and agents that connect by URL") {
                SettingRow(label: "Serve the tools on this Mac") {
                    Toggle("", isOn: Binding(get: { agents.running }, set: { $0 ? agents.start() : agents.stop() }))
                        .toggleStyle(ShuToggleStyle())
                        .labelsHidden()
                }
                if agents.running {
                    CodeBlock(text: agents.url)
                    Text("Only this Mac can reach it, and only with the key in the link. ChatGPT needs a public https address: put a tunnel such as cloudflared in front of port \(AgentServer.port) and add the same key.")
                        .font(Face.body)
                        .foregroundStyle(Ink.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let problem = agents.problem {
                    HStack(alignment: .firstTextBaseline, spacing: Space.s) {
                        Image(systemName: "exclamationmark.circle").font(Face.icon).foregroundStyle(Ink.secondary)
                        Text(problem).font(Face.body).foregroundStyle(Ink.text)
                    }
                }
            }
        }
    }

    private func group<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Space.s) {
            SectionTitle(title)
            content()
        }
    }
}

/// Monospaced snippet with a copy button.
struct CodeBlock: View {
    let text: String
    @State private var copied = false

    var body: some View {
        HStack(alignment: .top, spacing: Space.m) {
            Text(text)
                .font(Face.meta)
                .foregroundStyle(Ink.text)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            Button(copied ? "copied" : "copy") {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(text, forType: .string)
                copied = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { copied = false }
            }
            .buttonStyle(.plain)
            .font(Face.meta)
            .foregroundStyle(Ink.muted)
        }
        .padding(Space.m)
        .background(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).fill(Ink.deepest))
        .overlay(RoundedRectangle(cornerRadius: Radius.control, style: .continuous).strokeBorder(Ink.hairline))
    }
}
