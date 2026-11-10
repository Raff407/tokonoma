import Testing
@testable import TokonomaCore

@Suite struct GridNavigationTests {
    let a = ["a0", "a1", "a2", "a3", "a4"]   // 3 columns: rows a0-a2, a3-a4
    let b = ["b0", "b1", "b2", "b3"]

    func go(_ d: GridNavigation.Direction, _ from: String?, cols: Int = 3) -> String? {
        GridNavigation.move(d, from: from, in: [a, b], columns: cols)
    }

    @Test func firstArrowSelectsTheFirstItem() {
        #expect(go(.down, nil) == "a0")
        #expect(go(.left, "missing") == "a0")
    }

    @Test func emptyGridSelectsNothing() {
        #expect(GridNavigation.move(.right, from: nil, in: [[], []], columns: 3) == nil)
    }

    @Test func sideStepsFollowReadingOrderAcrossSections() {
        #expect(go(.right, "a1") == "a2")
        #expect(go(.right, "a4") == "b0")
        #expect(go(.left, "b0") == "a4")
        #expect(go(.left, "a0") == "a0")
        #expect(go(.right, "b3") == "b3")
    }

    @Test func downKeepsTheColumnAndCrossesSections() {
        #expect(go(.down, "a0") == "a3")
        #expect(go(.down, "a2") == "a4")     // short last row: land on the last item
        #expect(go(.down, "a4") == "b1")     // last row of a: column 1 of b
        #expect(go(.down, "a3") == "b0")
        #expect(go(.down, "b3") == "b3")     // nothing below
    }

    @Test func upKeepsTheColumnAndCrossesSections() {
        #expect(go(.up, "a4") == "a1")
        #expect(go(.up, "b1") == "a4")       // last row of a, column 1
        #expect(go(.up, "b2") == "a4")       // column 2 is past a's short last row: clamp
        #expect(go(.up, "a1") == "a1")       // nothing above
    }

    @Test func oneColumnIsAList() {
        #expect(go(.down, "a4", cols: 1) == "b0")
        #expect(go(.up, "b0", cols: 1) == "a4")
    }
}
