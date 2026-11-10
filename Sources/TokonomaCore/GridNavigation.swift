import Foundation

/// Where an arrow key moves the highlight in a grid of sections.
/// Left and right step through the reading order. Up and down keep the column
/// and cross into the next or previous section when a section runs out.
public enum GridNavigation {
    public enum Direction: Sendable { case left, right, up, down }

    public static func move(_ direction: Direction, from current: String?, in sections: [[String]], columns: Int) -> String? {
        let sections = sections.filter { !$0.isEmpty }
        guard let first = sections.first?.first else { return nil }
        guard let current, let at = position(of: current, in: sections) else { return first }
        let (s, i) = at
        let count = sections[s].count
        let columns = max(1, columns)
        switch direction {
        case .left:
            if i > 0 { return sections[s][i - 1] }
            return s > 0 ? sections[s - 1].last : current
        case .right:
            if i + 1 < count { return sections[s][i + 1] }
            return s + 1 < sections.count ? sections[s + 1].first : current
        case .up:
            if i - columns >= 0 { return sections[s][i - columns] }
            guard s > 0 else { return current }
            let above = sections[s - 1]
            let lastRow = ((above.count - 1) / columns) * columns
            return above[min(lastRow + i % columns, above.count - 1)]
        case .down:
            if i + columns < count { return sections[s][i + columns] }
            if i / columns < (count - 1) / columns { return sections[s][count - 1] }
            guard s + 1 < sections.count else { return current }
            let below = sections[s + 1]
            return below[min(i % columns, below.count - 1)]
        }
    }

    private static func position(of id: String, in sections: [[String]]) -> (Int, Int)? {
        for (s, items) in sections.enumerated() {
            if let i = items.firstIndex(of: id) { return (s, i) }
        }
        return nil
    }
}
