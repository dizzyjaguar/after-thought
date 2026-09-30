// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "AfterThought",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "AfterThought",
            path: "Sources/AfterThought",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("WebKit"),
                .linkedFramework("Carbon"),
                .linkedFramework("ServiceManagement"),
            ]
        ),
        .testTarget(
            name: "AfterThoughtTests",
            dependencies: ["AfterThought"],
            path: "Tests/AfterThoughtTests"
        ),
    ]
)
