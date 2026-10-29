// swift-tools-version:5.9
//
// Lets CI (and anyone on the team) build and test the DormWash SwiftUI
// code without an .xcodeproj. The Swift screens live in appComponents/
// alongside their web versions (the .html files, which Swift ignores).
//
// To open in Xcode: File > Open… and pick this folder (or Package.swift).
// When you add a new .swift file to appComponents/, add its name to `sources` below.

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
            path: "appComponents",
            exclude: ["washer.html", "dryer.html", "all.html"],
            sources: [
                "WasherTimerView.swift",
                "DormWashStatusView.swift"
            ]
        ),
        .testTarget(
            name: "DormWashTests",
            dependencies: ["DormWash"],
            path: "Tests/DormWashTests"
        )
    ]
)
