// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OfflineDownload",
    platforms: [.iOS(.v16)],
    products: [
        .library(name: "OfflineDownload", targets: ["OfflineDownload"])
    ],
    targets: [
        .target(name: "OfflineDownload")
    ]
)
