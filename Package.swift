// swift-tools-version:5.9
//
// Lets CI (and anyone on the team) build and test the DormWash SwiftUI
// code without an .xcodeproj. It points at the Swift files where they
// already live, so nothing has to be moved.
//
// To open in Xcode: File > Open… and pick this folder (or Package.swift).
// When you add a new .swift file to the repo, add its name to `sources` below.

import PackageDescription

let package = Package(
    name: "DormWash",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "DormWash", targets: ["DormWash"])
    ],
    targets: [
        .target(
            name: "DormWash",
            path: ".",
            exclude: [
                "Tests", "server", "server.js", "package.json", "washer.html", "dryer.html", "all.html",
                "README.md", "LICENSE"
            ],
            sources: [
                "WasherTimerView.swift",
                "DormWashStatusView (1).swift"
            ]
        ),
        .testTarget(
            name: "DormWashTests",
            dependencies: ["DormWash"],
            path: "Tests/DormWashTests"
        )
    ]
)
