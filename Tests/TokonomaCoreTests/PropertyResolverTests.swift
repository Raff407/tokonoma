import Foundation
import Testing
@testable import TokonomaCore

private let specs: [PropertySpec] = [
    PropertySpec(key: "wind", label: "wind", kind: .range, min: 0, max: 2, step: 0.5, defaultValue: .number(1)),
    PropertySpec(key: "season", label: "season", kind: .choice, options: ["auto", "spring"], defaultValue: .text("auto")),
    PropertySpec(key: "fox", label: "fox", kind: .toggle, defaultValue: .flag(true)),
    PropertySpec(key: "ink", label: "ink", kind: .color, defaultValue: .text("#112233")),
]

@Suite struct PropertyResolverTests {
    @Test func defaultsWhenNothingIsOverridden() {
        let values = PropertyResolver.resolve(specs, overrides: [:])
        #expect(values == ["wind": .number(1), "season": .text("auto"), "fox": .flag(true), "ink": .text("#112233")])
    }

    @Test func rangesClampAndSnapToStep() {
        #expect(PropertyResolver.sanitize(.number(9), for: specs[0]) == .number(2))
        #expect(PropertyResolver.sanitize(.number(-1), for: specs[0]) == .number(0))
        #expect(PropertyResolver.sanitize(.number(1.3), for: specs[0]) == .number(1.5))
    }

    @Test func choicesOutsideTheListFallBack() {
        #expect(PropertyResolver.sanitize(.text("winter"), for: specs[1]) == .text("auto"))
        #expect(PropertyResolver.sanitize(.text("spring"), for: specs[1]) == .text("spring"))
    }

    @Test func wrongTypesFallBackToDefault() {
        #expect(PropertyResolver.sanitize(.text("yes"), for: specs[2]) == .flag(true))
        #expect(PropertyResolver.sanitize(.flag(false), for: specs[0]) == .number(1))
        #expect(PropertyResolver.sanitize(.text("blue"), for: specs[3]) == .text("#112233"))
        #expect(PropertyResolver.sanitize(.text("#abc"), for: specs[3]) == .text("#abc"))
    }

    @Test func unknownOverridesAreDropped() {
        let values = PropertyResolver.resolve(specs, overrides: ["ghost": .number(1)])
        #expect(values["ghost"] == nil)
    }

    @Test func javascriptPayloadIsValidJSON() throws {
        let json = try PropertyResolver.javascriptObject(["wind": .number(1.5), "quote": .text("it's \"fine\"</script>")])
        let back = try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any]
        #expect(back?["wind"] as? Double == 1.5)
        #expect(back?["quote"] as? String == "it's \"fine\"</script>")
        #expect(!json.contains("</script>"))
    }
}
