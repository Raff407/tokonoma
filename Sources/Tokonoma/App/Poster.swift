import AVFoundation
import AppKit
import TokonomaCore

/// Grabs one frame from an imported video as poster.jpg, so the page has
/// something to weave before playback starts (and for hidden thumbnails).
enum Poster {
    static let fileName = "poster.jpg"

    static func ensure(for wallpaper: Wallpaper) async {
        guard let media = wallpaper.manifest.media,
              MediaImporter.kind(of: URL(fileURLWithPath: media)) == .video else { return }
        let target = wallpaper.folder.appendingPathComponent(fileName)
        guard !FileManager.default.fileExists(atPath: target.path) else { return }

        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: wallpaper.folder.appendingPathComponent(media)))
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 1920, height: 1920)
        do {
            let (frame, _) = try await generator.image(at: CMTime(seconds: 0.5, preferredTimescale: 600))
            let rep = NSBitmapImageRep(cgImage: frame)
            guard let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.85]) else { return }
            try data.write(to: target, options: .atomic)
        } catch {
            NSLog("tokonoma: no poster frame for \(wallpaper.id): \(error)")
        }
    }
}
