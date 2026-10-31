// Draws the app icon: a vermilion torii woven out of small cells on lacquer black.
// usage: xcrun swift scripts/make-icon.swift <out.iconset>
import AppKit

let out = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "build/AppIcon.iconset")
try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)

/// The gate as separate solid pieces, so overlaps never cancel each other out.
func torii(in r: CGRect) -> [NSBezierPath] {
    let u = r.width / 18
    let x0 = r.minX
    let y0 = r.minY
    func p(_ x: CGFloat, _ y: CGFloat) -> NSPoint { NSPoint(x: x0 + x * u, y: y0 + (18 - y) * u) }
    let kasagi = NSBezierPath()
    kasagi.move(to: p(1, 3))
    kasagi.curve(to: p(17, 3), controlPoint1: p(6, 5.2), controlPoint2: p(12, 5.2))
    kasagi.line(to: p(16.4, 5.4))
    kasagi.curve(to: p(1.6, 5.4), controlPoint1: p(12, 7), controlPoint2: p(6, 7))
    kasagi.close()
    var pieces = [
        kasagi,
        NSBezierPath(rect: NSRect(origin: p(2.5, 9.8), size: NSSize(width: 13 * u, height: 1.6 * u))),
        NSBezierPath(rect: NSRect(origin: p(3.2, 6.6), size: NSSize(width: 11.6 * u, height: 1.1 * u))),
    ]
    for x in [4.6, 12.0] {
        let pillar = NSBezierPath()
        let lean: CGFloat = x < 9 ? 0.25 : -0.25
        pillar.move(to: p(x + lean, 5.5))
        pillar.line(to: p(x + 1.4 + lean, 5.5))
        pillar.line(to: p(x + 1.5, 16.5))
        pillar.line(to: p(x - 0.1, 16.5))
        pillar.close()
        pieces.append(pillar)
    }
    return pieces
}

func render(_ size: Int) -> Data {
    let s = CGFloat(size)
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
                               samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                               bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let inset = s * 0.1
    let tile = NSRect(x: inset, y: inset, width: s - inset * 2, height: s - inset * 2)
    let shape = NSBezierPath(roundedRect: tile, xRadius: tile.width * 0.225, yRadius: tile.width * 0.225)
    NSColor(srgbRed: 0.086, green: 0.082, blue: 0.075, alpha: 1).setFill()
    shape.fill()
    shape.addClip()

    let gate = torii(in: tile.insetBy(dx: tile.width * 0.16, dy: tile.width * 0.16))
    let cells = 30
    let cell = tile.width / CGFloat(cells)
    let shu = NSColor(srgbRed: 0.84, green: 0.27, blue: 0.17, alpha: 1)
    let ash = NSColor(srgbRed: 0.94, green: 0.91, blue: 0.87, alpha: 0.08)
    for row in 0..<cells {
        for col in 0..<cells {
            let r = NSRect(x: tile.minX + CGFloat(col) * cell, y: tile.minY + CGFloat(row) * cell, width: cell, height: cell)
            let inside = gate.contains { $0.contains(NSPoint(x: r.midX, y: r.midY)) }
            // Each cell is a short horizontal thread, like the "≡" in the glyph ramp.
            let thread = NSRect(x: r.minX + cell * 0.14, y: r.midY - cell * 0.16, width: cell * 0.72, height: cell * 0.32)
            (inside ? shu : ash).setFill()
            NSBezierPath(roundedRect: thread, xRadius: cell * 0.08, yRadius: cell * 0.08).fill()
        }
    }
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}

for base in [16, 32, 128, 256, 512] {
    try render(base).write(to: out.appendingPathComponent("icon_\(base)x\(base).png"))
    try render(base * 2).write(to: out.appendingPathComponent("icon_\(base)x\(base)@2x.png"))
}
print("wrote \(out.path)")
