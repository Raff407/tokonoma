import Foundation
import Testing
@testable import TokonomaCore

private let toriiJSON = """
{
  "id": "torii",
  "name": "Torii",
  "title": "鳥居",
  "description": "A gate.",
  "entry": "index.html",
  "version": 1,
  "interactive": true,
  "properties": [
    { "key": "season", "label": "season", "type": "choice", "options": ["auto", "spring"], "default": "auto" },
    { "key": "wind", "label": "wind", "type": "range", "min": 0, "max": 2, "step": 0.1, "default": 1 },
    { "key": "fox", "label": "fox", "type": "toggle", "default": true },
    { "key": "ink", "label": "ink", "type": "color", "default": "#112233" }
  ]
}
"""

@Suite struct ManifestTests {
    @Test func decodesEveryPropertyKind() throws {
        let manifest = try Manifest.decode(Data(toriiJSON.utf8))
        #expect(manifest.id == "torii")
        #expect(manifest.title == "鳥居")
        #expect(manifest.interactive == true)
        #expect(manifest.properties.map(\.key) == ["season", "wind", "fox", "ink"])
        #expect(manifest.properties[0].kind == .choice)
        #expect(manifest.properties[0].options == ["auto", "spring"])
        #expect(manifest.properties[1].defaultValue == .number(1))
        #expect(manifest.properties[2].defaultValue == .flag(true))
        #expect(manifest.properties[3].defaultValue == .text("#112233"))
    }

    @Test func optionalFieldsDefaultSensibly() throws {
        let manifest = try Manifest.decode(Data(#"{"id":"x","name":"X","entry":"index.html"}"#.utf8))
        #expect(manifest.title == nil)
        #expect(manifest.properties.isEmpty)
        #expect(manifest.interactive == false)
        #expect(manifest.version == 1)
    }

    @Test func rejectsUnsafeIDs() {
        for bad in ["", "../escape", "a/b", ".hidden", "_lib"] {
            let json = #"{"id":"\#(bad)","name":"X","entry":"index.html"}"#
            #expect(throws: ManifestError.self) { try Manifest.decode(Data(json.utf8)) }
        }
    }

    @Test func rejectsEntriesOutsideTheFolder() {
        for bad in ["../index.html", "/etc/passwd", ""] {
            let json = #"{"id":"ok","name":"X","entry":"\#(bad)"}"#
            #expect(throws: ManifestError.self) { try Manifest.decode(Data(json.utf8)) }
        }
    }

    @Test func rejectsDefaultsOfTheWrongType() {
        let json = """
        {"id":"ok","name":"X","entry":"index.html","properties":[
          {"key":"wind","label":"wind","type":"range","min":0,"max":2,"default":"loud"}
        ]}
        """
        #expect(throws: ManifestError.self) { try Manifest.decode(Data(json.utf8)) }
    }

    @Test func roundTripsThroughJSON() throws {
        let manifest = try Manifest.decode(Data(toriiJSON.utf8))
        let again = try Manifest.decode(manifest.encoded())
        #expect(again == manifest)
    }
}

@Suite struct ManifestHardeningTests {
    private func manifest(_ properties: String) -> Data {
        Data(#"{"id":"ok","name":"X","entry":"index.html","properties":[\#(properties)]}"#.utf8)
    }

    @Test func rejectsDuplicateKeys() {
        let json = manifest("""
          {"key":"a","label":"a","type":"toggle","default":true},
          {"key":"a","label":"b","type":"toggle","default":false}
        """)
        #expect(throws: ManifestError.self) { try Manifest.decode(json) }
    }

    @Test func rejectsEmptyKeys() {
        #expect(throws: ManifestError.self) {
            try Manifest.decode(manifest(#"{"key":"","label":"a","type":"toggle","default":true}"#))
        }
    }

    @Test func rejectsBackwardsOrBrokenRanges() {
        let bad = [
            #"{"key":"r","label":"r","type":"range","min":5,"max":1,"default":3}"#,
            #"{"key":"r","label":"r","type":"range","min":0,"max":1,"step":0,"default":0.5}"#,
            #"{"key":"r","label":"r","type":"range","min":0,"max":1,"step":-1,"default":0.5}"#,
            #"{"key":"r","label":"r","type":"range","min":0,"max":1,"default":7}"#,
            #"{"key":"r","label":"r","type":"range","default":1e300}"#,
            #"{"key":"r","label":"r","type":"range","min":2,"default":3}"#,
        ]
        for json in bad {
            #expect(throws: ManifestError.self, "should reject \(json)") { try Manifest.decode(manifest(json)) }
        }
    }

    @Test func acceptsAWellFormedRange() throws {
        let ok = try Manifest.decode(manifest(#"{"key":"r","label":"r","type":"range","min":0,"max":2,"step":0.5,"default":1}"#))
        #expect(ok.properties.count == 1)
    }

    @Test func rejectsChoicesWithoutOptions() {
        #expect(throws: ManifestError.self) {
            try Manifest.decode(manifest(#"{"key":"c","label":"c","type":"choice","options":[],"default":"x"}"#))
        }
    }

    @Test func resolveSurvivesDuplicatesThatSlipThrough() {
        let spec = PropertySpec(key: "a", label: "a", kind: .toggle, defaultValue: .flag(true))
        let values = PropertyResolver.resolve([spec, spec], overrides: [:])
        #expect(values == ["a": .flag(true)])
    }
}
