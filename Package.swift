// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Tokonoma",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "Tokonoma", targets: ["Tokonoma"]),
    ],
    targets: [
        .target(name: "TokonomaCore"),
        .executableTarget(
            name: "Tokonoma",
            dependencies: ["TokonomaCore"],
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
        .testTarget(name: "TokonomaCoreTests", dependencies: ["TokonomaCore"]),
    ]
)
