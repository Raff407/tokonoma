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
