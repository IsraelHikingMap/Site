import Compression
import Foundation
import PMTiles

/// Reads offline vector tiles from the PMTiles archives the app downloads into its Documents
/// directory (Capacitor `Directory.Data`). Mirrors `PmTilesService.kt` and `pmtiles.service.ts`: the `{type}+{id}.pmtiles`
/// of the smallest downloaded area that holds the zoom of the tile and overlaps it, so that an area is read before the
/// root files of the whole world. An area holds every tile its polygon touches, so a tile along its border is read from
/// it even when its center is outside.
final class PMTilesService {

    private static let areaFileSuffix = ".area.json"
    private static let areasRefreshInterval: TimeInterval = 30

    /// An area the app downloaded, as it keeps it next to its files in an "id.area.json" file, see offline-areas.service.ts,
    /// where the root files and the tiles that came before areas are areas as well
    private struct DownloadedArea {
        let id: String
        let polygons: [[[[Double]]]]
        let zooms: ClosedRange<Int>

        var boundsArea: Double {
            let points = polygons.joined().joined()
            let lngs = points.map { $0[0] }, lats = points.map { $0[1] }
            return ((lngs.max() ?? 0) - (lngs.min() ?? 0)) * ((lats.max() ?? 0) - (lats.min() ?? 0))
        }
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
        let tile = TileBounds(minLng: Self.tileLng(x: x, z: z), minLat: Self.tileLat(y: y + 1, z: z),
                              maxLng: Self.tileLng(x: x + 1, z: z), maxLat: Self.tileLat(y: y, z: z))
        return downloadedAreas()
            .filter { area in area.zooms.contains(z) && area.polygons.contains { Self.intersects($0, tile) } }
            .lazy.compactMap { self.existing("\(type)+\($0.id).pmtiles") }
            .first
    }

    private func existing(_ name: String) -> String? {
        FileManager.default.fileExists(atPath: baseDir.appendingPathComponent(name).path) ? name : nil
    }

    /// The areas, smallest first, are read again every so often rather than for every tile, so that one downloaded meanwhile shows up
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
                  let properties = area["properties"] as? [String: Any],
                  let id = properties["id"] as? String,
                  let geometry = area["geometry"] as? [String: Any]
            else { return nil }
            let zooms = (properties["minZoom"] as? Int ?? 0)...(properties["maxZoom"] as? Int ?? Int.max)
            if geometry["type"] as? String == "MultiPolygon" {
                guard let polygons = geometry["coordinates"] as? [[[[Double]]]] else { return nil }
                return DownloadedArea(id: id, polygons: polygons, zooms: zooms)
            }
            guard let polygon = geometry["coordinates"] as? [[[Double]]] else { return nil }
            return DownloadedArea(id: id, polygons: [polygon], zooms: zooms)
        }.sorted { $0.boundsArea < $1.boundsArea }
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

    private struct TileBounds {
        let minLng: Double, minLat: Double, maxLng: Double, maxLat: Double

        var corners: [[Double]] { [[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat]] }

        func contains(_ point: [Double]) -> Bool {
            (minLng...maxLng).contains(point[0]) && (minLat...maxLat).contains(point[1])
        }
    }

    /// Whether a polygon and a tile overlap: a corner of the tile is in the polygon, a point of the polygon is in the tile,
    /// or one of their edges crosses the other's
    private static func intersects(_ rings: [[[Double]]], _ tile: TileBounds) -> Bool {
        let corners = tile.corners
        if corners.contains(where: { contains(rings, lng: $0[0], lat: $0[1]) }) {
            return true
        }
        let tileEdges = corners.indices.map { (corners[$0], corners[($0 + 1) % corners.count]) }
        return rings.contains { ring in
            ring.indices.contains { index in
                let start = ring[index], end = ring[(index + 1) % ring.count]
                return tile.contains(start) || tileEdges.contains { crosses(start, end, $0.0, $0.1) }
            }
        }
    }

    private static func crosses(_ a: [Double], _ b: [Double], _ c: [Double], _ d: [Double]) -> Bool {
        side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0
    }

    private static func side(_ a: [Double], _ b: [Double], _ point: [Double]) -> Double {
        let cross = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0])
        return cross > 0 ? 1 : cross < 0 ? -1 : 0
    }

    private static func tileLng(x: Int, z: Int) -> Double {
        Double(x) / Double(1 << z) * 360 - 180
    }

    private static func tileLat(y: Int, z: Int) -> Double {
        atan(sinh(Double.pi * (1 - 2 * Double(y) / Double(1 << z)))) * 180 / Double.pi
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
