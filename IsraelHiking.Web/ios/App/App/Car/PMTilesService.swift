import Compression
import Foundation
import PMTiles

/**
 * Reads offline vector tiles from the PMTiles archives the app downloads into its Documents
 * directory (Capacitor `Directory.Data`). Mirrors `PmTilesService.kt`: same sub-pyramid file
 * naming (`{type}+7-{x}-{y}.pmtiles` for z>=7, `{type}-6.pmtiles` below)
 */
final class PMTilesService {

    static let tilesZoom = 7

    private let baseDir: URL
    private let lock = NSLock()
    private var readers: [String: PMTilesReader] = [:]

    init() {
        baseDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
    }

    func isOfflineFileAvailable(z: Int, x: Int, y: Int, type: String) -> Bool {
        let url = baseDir.appendingPathComponent(fileName(z: z, x: x, y: y, type: type))
        return FileManager.default.fileExists(atPath: url.path)
    }

    /// Returns the decompressed tile bytes, or nil when the archive has no such tile.
    func getTileByType(z: Int, x: Int, y: Int, type: String) -> Data? {
        let name = fileName(z: z, x: x, y: y, type: type)
        guard let reader = getReader(for: name) else { return nil }
        return reader.tile(z: z, x: x, y: y)
    }

    private func fileName(z: Int, x: Int, y: Int, type: String) -> String {
        if z >= Self.tilesZoom {
            let scale = 1 << (z - Self.tilesZoom)
            return "\(type)+\(Self.tilesZoom)-\(x / scale)-\(y / scale).pmtiles"
        }
        return "\(type)-\(Self.tilesZoom - 1).pmtiles"
    }

    private func getReader(for name: String) -> PMTilesReader? {
        lock.lock(); defer { lock.unlock() }
        if let cached = readers[name] { return cached }
        let url = baseDir.appendingPathComponent(name)
        guard FileManager.default.fileExists(atPath: url.path),
              let reader = try? PMTilesReader(path: url.path)
        else { return nil }
        readers[name] = reader
        return reader
    }
}
