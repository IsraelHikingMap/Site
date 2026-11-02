import Compression
import Foundation
import PMTiles

/// Reads offline vector tiles from the PMTiles archives the app downloads into its Documents
/// directory (Capacitor `Directory.Data`). Mirrors `PmTilesService.kt` and `pmtiles.service.ts`: `{type}-4.pmtiles`
/// up to zoom 4, the zoom 7 tile's `{type}+{x}-{y}.pmtiles`, the `{type}+{id}.pmtiles` of the downloaded area the
/// tile's center is in, and below zoom 7 the `{type}-6.pmtiles` the tiles that came before areas were downloaded with.
final class PMTilesService {

    static let tilesZoom = 7
    static let rootZoom = 4
    private static let areaFileSuffix = ".area.json"
    private static let areasRefreshInterval: TimeInterval = 30

    /// An area the app downloaded, as it keeps it next to its files in an "id.area.json" file, see offline-areas.service.ts
    private struct DownloadedArea {
        let id: String
        let polygons: [[[[Double]]]]
    }

    private let baseDir: URL
    private let lock = NSLock()
    private var readers: [String: PmTilesReader] = [:]
    private var areas: [DownloadedArea] = []
    private var areasReadAt = Date.distantPast

    init() {
        baseDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
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

    private func fileName(z: Int, x: Int, y: Int, type: String) -> String? {
        if z <= Self.rootZoom, let rootFile = existing("\(type)-\(Self.rootZoom).pmtiles") {
            return rootFile
        }
        if z >= Self.tilesZoom {
            let scale = 1 << (z - Self.tilesZoom)
            if let tileFile = existing("\(type)+\(x / scale)-\(y / scale).pmtiles") {
                return tileFile
            }
        }
        let lng = Self.tileCenterLng(x: x, z: z)
        let lat = Self.tileCenterLat(y: y, z: z)
        let areaFile = downloadedAreas()
            .filter { area in area.polygons.contains { Self.contains($0, lng: lng, lat: lat) } }
            .lazy.compactMap { self.existing("\(type)+\($0.id).pmtiles") }
            .first
        return areaFile ?? (z < Self.tilesZoom ? existing("\(type)-\(Self.tilesZoom - 1).pmtiles") : nil)
    }

    private func existing(_ name: String) -> String? {
        FileManager.default.fileExists(atPath: baseDir.appendingPathComponent(name).path) ? name : nil
    }

    /// The areas are read again every so often rather than for every tile, so that one downloaded meanwhile shows up
    private func downloadedAreas() -> [DownloadedArea] {
        lock.lock(); defer { lock.unlock() }
        if Date().timeIntervalSince(areasReadAt) < Self.areasRefreshInterval {
            return areas
        }
        areasReadAt = Date()
        let names = (try? FileManager.default.contentsOfDirectory(atPath: baseDir.path)) ?? []
        areas = names.filter { $0.hasSuffix(Self.areaFileSuffix) }.compactMap { name in
            guard let data = FileManager.default.contents(atPath: baseDir.appendingPathComponent(name).path),
                  let area = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let id = (area["properties"] as? [String: Any])?["id"] as? String,
                  let geometry = area["geometry"] as? [String: Any]
            else { return nil }
            if geometry["type"] as? String == "MultiPolygon" {
                guard let polygons = geometry["coordinates"] as? [[[[Double]]]] else { return nil }
                return DownloadedArea(id: id, polygons: polygons)
            }
            guard let polygon = geometry["coordinates"] as? [[[Double]]] else { return nil }
            return DownloadedArea(id: id, polygons: [polygon])
        }
        return areas
    }

    /// Even-odd ray casting over every ring, so a point in a hole is outside
    private static func contains(_ rings: [[[Double]]], lng: Double, lat: Double) -> Bool {
        var inside = false
        for ring in rings where ring.count > 1 {
            var j = ring.count - 1
            for i in 0..<ring.count {
                let xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
                if (yi > lat) != (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi {
                    inside.toggle()
                }
                j = i
            }
        }
        return inside
    }

    private static func tileCenterLng(x: Int, z: Int) -> Double {
        (Double(x) + 0.5) / Double(1 << z) * 360 - 180
    }

    private static func tileCenterLat(y: Int, z: Int) -> Double {
        atan(sinh(Double.pi * (1 - 2 * (Double(y) + 0.5) / Double(1 << z)))) * 180 / Double.pi
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
