// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "AfterThought",
    platforms: [.macOS(.v13)],
    dependencies: [
        // Checks for updates and installs them (the "new version available" popup).
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.6.0"),
    ],
    targets: [
        .executableTarget(
            name: "AfterThought",
            dependencies: [.product(name: "Sparkle", package: "Sparkle")],
            path: "Sources/AfterThought",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("WebKit"),
                .linkedFramework("Carbon"),
                .linkedFramework("ServiceManagement"),
                // Sparkle.framework is copied into Contents/Frameworks by build.sh.
                .unsafeFlags(["-Xlinker", "-rpath", "-Xlinker", "@executable_path/../Frameworks"]),
            ]
        ),
        .testTarget(
            name: "AfterThoughtTests",
            dependencies: ["AfterThought"],
            path: "Tests/AfterThoughtTests"
        ),
    ]
)
