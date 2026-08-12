import Foundation

/**
 * The routing tiles on the device, mirroring `ValhallaTiles.kt`.
 *
 * Every downloaded slice is a tar of a valhalla tile tree that is extracted into a single shared
 * directory. Tiles are keyed by their grid cell, so adjacent slices simply add their own cells and
 * routing can cross from one slice to the next.
 *
 * Slices do share tiles though - a slice is roughly 2.8 degrees while valhalla's highway tiles are
 * 4 degrees and its arterial tiles are 1 degree, so a tile on the edge of a slice is also in its
 * neighbour's tar. Each slice therefore records what it extracted, and deleting a slice only
 * removes the tiles that no remaining slice lists.
 */
final class ValhallaTiles {
    private static let tilesDirName = "valhalla_tiles"

    /// Kept next to the tiles directory rather than inside it, so that valhalla only ever sees
    /// tiles in the directory it is pointed at.
    private static let manifestsDirName = "valhalla_manifests"
    private static let manifestExtension = "txt"

    struct ExtractResult {
        let extractedFiles: Int
        let tilesDir: String
    }

    private let fileManager = FileManager.default

    /// The downloaded tar is written by the web layer into capacitor's data directory, which on iOS
    /// is the documents directory, so everything lives there.
    private var dataURL: URL {
        fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    var tilesURL: URL {
        dataURL.appendingPathComponent(ValhallaTiles.tilesDirName, isDirectory: true)
    }

    private var manifestsURL: URL {
        dataURL.appendingPathComponent(ValhallaTiles.manifestsDirName, isDirectory: true)
    }

    private func manifestURL(_ sliceId: String) -> URL {
        manifestsURL.appendingPathComponent(sliceId).appendingPathExtension(ValhallaTiles.manifestExtension)
    }

    func hasTiles() -> Bool {
        let contents = try? fileManager.contentsOfDirectory(atPath: tilesURL.path)
        return !(contents?.isEmpty ?? true)
    }

    func clear() throws {
        try? fileManager.removeItem(at: tilesURL)
        try? fileManager.removeItem(at: manifestsURL)
    }

    /**
     * Extracts the given tar, which is expected to be in the data directory, into the tiles
     * directory, and records the tiles it holds under `sliceId`. The tar is deleted afterwards - it
     * is large and is of no use once extracted.
     */
    func extract(tarFileName: String, sliceId: String) throws -> ExtractResult {
        let tarURL = dataURL.appendingPathComponent(tarFileName)
        guard fileManager.fileExists(atPath: tarURL.path) else {
            throw ValhallaTarError.tarNotFound(tarURL.path)
        }
        defer { try? fileManager.removeItem(at: tarURL) }

        let extractedPaths = try ValhallaTarExtractor.extract(tarAt: tarURL, into: tilesURL)
        excludeTilesFromBackup()

        // When a slice is downloaded again it might no longer hold tiles it used to
        let removedPaths = Set(readManifest(sliceId)).subtracting(extractedPaths)
        try writeManifest(sliceId, paths: extractedPaths)
        deleteUnreferenced(removedPaths)

        return ExtractResult(extractedFiles: extractedPaths.count, tilesDir: tilesURL.path)
    }

    /**
     * Removes the tiles of the given slice, keeping any tile that a remaining slice still lists.
     */
    func delete(sliceId: String) {
        let paths = readManifest(sliceId)
        try? fileManager.removeItem(at: manifestURL(sliceId))
        deleteUnreferenced(Set(paths))
    }

    /**
     * Deletes the given tiles, except for those that are listed in a manifest of another slice.
     */
    private func deleteUnreferenced(_ paths: Set<String>) {
        if paths.isEmpty {
            return
        }
        var stillNeeded = Set<String>()
        let manifests = (try? fileManager.contentsOfDirectory(at: manifestsURL, includingPropertiesForKeys: nil)) ?? []
        for manifest in manifests {
            guard let contents = try? String(contentsOf: manifest, encoding: .utf8) else {
                continue
            }
            stillNeeded.formUnion(contents.split(separator: "\n").map(String.init))
        }
        for path in paths.subtracting(stillNeeded) {
            let fileURL = tilesURL.appendingPathComponent(path)
            try? fileManager.removeItem(at: fileURL)
            deleteEmptyParents(of: fileURL)
        }
        if (try? fileManager.contentsOfDirectory(atPath: tilesURL.path))?.isEmpty == true {
            try? fileManager.removeItem(at: tilesURL)
        }
    }

    private func deleteEmptyParents(of fileURL: URL) {
        var current = fileURL.deletingLastPathComponent()
        while current.path != tilesURL.path && current.path.hasPrefix(tilesURL.path) {
            guard (try? fileManager.contentsOfDirectory(atPath: current.path))?.isEmpty == true,
                  (try? fileManager.removeItem(at: current)) != nil else {
                return
            }
            current = current.deletingLastPathComponent()
        }
    }

    private func readManifest(_ sliceId: String) -> [String] {
        guard let contents = try? String(contentsOf: manifestURL(sliceId), encoding: .utf8) else {
            return []
        }
        return contents.split(separator: "\n").map(String.init)
    }

    private func writeManifest(_ sliceId: String, paths: [String]) throws {
        try fileManager.createDirectory(at: manifestsURL, withIntermediateDirectories: true)
        try paths.joined(separator: "\n").write(to: manifestURL(sliceId), atomically: true, encoding: .utf8)
    }

    /**
     * The tiles can always be downloaded again, so they should not take up space in the user's backup.
     */
    private func excludeTilesFromBackup() {
        var url = tilesURL
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? url.setResourceValues(values)
    }
}
