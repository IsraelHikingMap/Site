import Foundation

/// The areas the app downloaded, as it keeps them next to their files in "id.area.json" files, where the root files and
/// the tiles that came before areas are areas as well - the counterpart of `offline-areas.service.ts` on the web client,
/// and of `OfflineAreas.kt` on Android.
final class OfflineAreas {

    private static let areaFileSuffix = ".area.json"
    private static let areasRefreshInterval: TimeInterval = 30
    /// How far inside its edges a tile is tested for overlapping an area, as a part of its size, see `findDownloadedAreaIdOfTile`
    private static let tileInset = 0.001

    private struct DownloadedArea {
        let id: String
        let polygons: [[[[Double]]]]
        let zooms: ClosedRange<Int>
        let boundsArea: Double
    }

    private let baseDir: URL
    private let lock = NSLock()
    private var areas: [DownloadedArea] = []
    private var areasReadAt = Date.distantPast

    init(baseDir: URL) {
        self.baseDir = baseDir
    }

    /// The downloaded area whose files hold a tile, the smallest of them where they overlap, so that an area is read before
    /// the root files of the whole world. An area holds every tile its polygon touches, so a tile along its border is read
    /// from it even when its center is outside. The tile is tested a little inside its edges, so that one that only touches
    /// an area, like the neighbour of a tile that came before areas, is not read from it.
    func findDownloadedAreaIdOfTile(z: Int, x: Int, y: Int) -> String? {
        let tile = SpatialHelper.getTilePolygon(x: x, y: y, zoom: z, inset: Self.tileInset)
        return downloadedAreas()
            .first { area in area.zooms.contains(z) && area.polygons.contains { SpatialHelper.intersects($0, tile) } }?
            .id
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
                  let geometry = area["geometry"] as? [String: Any],
                  let polygons = geometry["type"] as? String == "MultiPolygon"
                    ? geometry["coordinates"] as? [[[[Double]]]]
                    : (geometry["coordinates"] as? [[[Double]]]).map({ [$0] })
            else { return nil }
            let zooms = (properties["minZoom"] as? Int ?? 0)...(properties["maxZoom"] as? Int ?? Int.max)
            return DownloadedArea(id: id, polygons: polygons, zooms: zooms, boundsArea: SpatialHelper.getBoundsArea(polygons))
        }.sorted { $0.boundsArea < $1.boundsArea }
        return areas
    }
}
