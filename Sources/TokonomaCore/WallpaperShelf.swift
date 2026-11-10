import Foundation

/// Which wallpapers each library tab shows. The Library tab leaves out Chinese
/// scenes (they live in their own tab); favourites and rotation still see all.
public enum WallpaperShelf {
    public static func chinese(_ all: [Wallpaper]) -> [Wallpaper] {
        all.filter(\.isChinese)
    }

    public static func withoutChinese(_ all: [Wallpaper]) -> [Wallpaper] {
        all.filter { !$0.isChinese }
    }
}
