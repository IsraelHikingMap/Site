import Compression
import Foundation
import PMTiles

/// Reads offline vector tiles from the PMTiles archives the app downloads into its Documents
/// directory (Capacitor `Directory.Data`), from the files of the downloaded area that holds the tile, see
/// `OfflineAreas.findDownloadedAreaIdOfTile`. Mirrors `PmTilesService.kt` and `pmtiles.service.ts`.
final class PMTilesService {

    private let baseDir: URL
    private let lock = NSLock()
    private var readers: [String: PmTilesReader] = [:]
    private let offlineAreas: OfflineAreas

    init() {
        baseDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        offlineAreas = OfflineAreas(baseDir: baseDir)
    }

    func isOfflineFileAvailable(z: Int, x: Int, y: Int, type: String) -> Bool {
        return fileName(z: z, x: x, y: y, type: type) != nil
    }

    /// Returns the decompressed tile bytes, or nil when the archive has no such tile.
    func getTileByType(z: Int, x: Int, y: Int, type: String) -> Data? {
        guard let name = fileName(z: z, x: x, y: y, type: type),
              let reader = getReader(for: name) else { return nil }
        return try? reader.getTile(z: UInt8(z), x: UInt32(x), y: UInt32(y))
    }

    /// The file a tile is read from, the one of the downloaded area that holds it
    private func fileName(z: Int, x: Int, y: Int, type: String) -> String? {
        guard let areaId = offlineAreas.findDownloadedAreaIdOfTile(z: z, x: x, y: y) else { return nil }
        let name = "\(type)+\(areaId).pmtiles"
        return FileManager.default.fileExists(atPath: baseDir.appendingPathComponent(name).path) ? name : nil
    }

    private func getReader(for name: String) -> PmTilesReader? {
        lock.lock(); defer { lock.unlock() }
        if let cached = readers[name] { return cached }
        let url = baseDir.appendingPathComponent(name)
        guard FileManager.default.fileExists(atPath: url.path),
              let reader = try? PmTilesReader.open(path: url.path)
        else { return nil }
        readers[name] = reader
        return reader
    }
}
