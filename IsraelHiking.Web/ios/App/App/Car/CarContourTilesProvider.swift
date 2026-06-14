import Foundation
import MaplibreContour

/**
 * Generates vector contour tiles on the fly from a terrain (DEM) source, mirroring
 * `CarContoursTilesProvider.kt` and what maplibre-contour does on the web. The native
 * maplibre-contour-rs library does the heavy lifting: we hand it a `DemTileFetcher` that downloads a
 * DEM tile and it returns a ready-to-render MVT for any z/x/y. `SliceURLProtocol` routes contour tile
 * requests here, passing the units carried in the tile URL.
 *
 * Units (metric/imperial) only change the elevation multiplier, so a manager is built and cached per
 * units string; the managers are thread-safe and shared across requests.
 */
final class CarContourTilesProvider {

    private let baseConfig: ContourConfig
    private let fetcher: DemTileFetcher
    private let lock = NSLock()
    private var managers: [String: DemManager] = [:]

    init() {
        // The layer/attribute names and thresholds must match what the style's contour layers expect
        // (see the web useContourProtocol in default-style.service.ts, which configures the same values).
        var config = defaultConfig()
        config.encoding = .terrarium
        config.demUrlPattern =
            "https://global.israelhikingmap.workers.dev/jaxa_terrarium0-11_v2/{z}/{x}/{y}.webp?use=slice"
        config.demMaxZoom = 11
        config.overzoom = 1
        config.thresholds = parseThresholdSpec(spec: "11*200*1000~12*10*100~13*10*100~14*10*100~15*10*100")
        config.layerName = "contours"
        config.elevationKey = "ele"
        config.levelKey = "level"
        baseConfig = config
        fetcher = ContourDemTileFetcher()
    }

    /// Returns the contour MVT for the tile, generated with the multiplier matching `units`.
    func getTile(z: Int, x: Int, y: Int, units: String) throws -> Data {
        try manager(for: units).tile(z: UInt8(z), x: UInt32(x), y: UInt32(y))
    }

    // One manager per units string; metric and imperial differ only by the elevation multiplier.
    private func manager(for units: String) -> DemManager {
        lock.lock(); defer { lock.unlock() }
        if let cached = managers[units] { return cached }
        var config = baseConfig
        config.multiplier = Self.multiplier(for: units)
        let manager = DemManager(fetcher: fetcher, config: config)
        managers[units] = manager
        return manager
    }

    private static func multiplier(for units: String) -> Float {
        units == unitImperial ? imperialMultiplier : metricMultiplier
    }

    private static let unitImperial = "imperial"
    private static let metricMultiplier: Float = 1.0
    private static let imperialMultiplier: Float = 3.28084
}

/**
 * Downloads the raw DEM tile bytes for a fully-resolved URL. The `use=slice` marker in the DEM URL
 * pattern routes the request through `SliceURLProtocol`, giving DEM fetches the same offline
 * (PMTiles) fallback the rest of the map enjoys. Returns nil when there is no data, which the library
 * renders as an empty contour tile.
 */
private final class ContourDemTileFetcher: DemTileFetcher, @unchecked Sendable {

    // Routes DEM requests through SliceURLProtocol (offline fallback). DEM URLs carry no `contour`
    // marker, so SliceURLProtocol serves them as normal slice tiles — no recursion back into contours.
    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.ephemeral
        var protocols: [AnyClass] = [SliceURLProtocol.self]
        protocols.append(contentsOf: config.protocolClasses ?? [])
        config.protocolClasses = protocols
        session = URLSession(configuration: config)
    }

    // Called synchronously by the native library; block until the tile request completes.
    func fetch(url: String) -> Data? {
        guard let requestUrl = URL(string: url) else { return nil }
        let semaphore = DispatchSemaphore(value: 0)
        var result: Data?
        let task = session.dataTask(with: requestUrl) { data, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                result = data
            }
            semaphore.signal()
        }
        task.resume()
        semaphore.wait()
        return result
    }
}

