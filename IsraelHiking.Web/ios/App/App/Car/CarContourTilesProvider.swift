import Foundation
import MaplibreContour

/// Generates vector contour tiles on the fly from a terrain (DEM) source. The native
/// maplibre-contour-rs library does the heavy lifting: we hand it a `DemTileFetcher` that downloads a
/// DEM tile and it returns a ready-to-render MVT for any z/x/y.
///
/// Units (metric/imperial) change the elevation multiplier and the contour thresholds, so a manager is
/// built and cached per units string; the managers are thread-safe and shared across requests.
///
/// The DEM is read up to the same zoom as on the web, `MapService.DEM_MAX_ZOOM`. It has its higher zooms
/// only where there is data, and the library falls back to the zoom below on a tile the fetcher answers
/// with nil.
final class CarContourTilesProvider {

    private let baseConfig: ContourConfig
    private let fetcher: DemTileFetcher
    private let lock = NSLock()
    private var managers: [String: DemManager] = [:]

    init() {
        var config = defaultConfig()
        config.encoding = .terrarium
        config.demUrlPattern =
            "https://mapeak.com/vector/data/raster-dem/{z}/{x}/{y}.webp?use=slice"
        config.demMaxZoom = 14
        config.overzoom = 1
        config.layerName = "contours"
        config.elevationKey = "ele"
        config.levelKey = "level"
        baseConfig = config
        fetcher = ContourDemTileFetcher()
    }

    /// Returns the contour MVT for the tile, generated with the multiplier and thresholds matching `units`.
    func getTile(z: Int, x: Int, y: Int, units: String) throws -> Data {
        try manager(for: units).tile(z: UInt8(z), x: UInt32(x), y: UInt32(y))
    }

    /// Retrieves a DemManager instance for the given units, creating one if necessary.
    private func manager(for units: String) -> DemManager {
        lock.lock(); defer { lock.unlock() }
        if let cached = managers[units] { return cached }
        var config = baseConfig
        config.multiplier = Self.multiplier(for: units)
        config.thresholds = parseThresholdSpec(spec: Self.thresholdSpec(for: units))
        let manager = DemManager(fetcher: fetcher, config: config)
        managers[units] = manager
        return manager
    }

    private static func multiplier(for units: String) -> Float {
        units == unitImperial ? imperialMultiplier : metricMultiplier
    }

    private static func thresholdSpec(for units: String) -> String {
        units == unitImperial ? imperialThresholds : metricThresholds
    }

    private static let unitImperial = "imperial"
    private static let metricMultiplier: Float = 1.0
    private static let imperialMultiplier: Float = 3.28084
    private static let metricThresholds = "9*500*2500~10*200*1000~11*100*500~12*50*250~13*20*100~14*10*50"
    private static let imperialThresholds = "9*1000*5000~10*500*2500~11*200*1000~12*100*500~13*40*200~14*20*100"
}

/// Downloads the raw DEM tile bytes for a fully-resolved URL. The `use=slice` marker in the DEM URL
/// pattern routes the request through `SliceURLProtocol`, giving DEM fetches the same offline
/// (PMTiles) fallback the rest of the map enjoys. Returns nil for a 404, a tile the DEM does not have,
/// which the library replaces with the zoom below, and throws for any other failure so that it is not
/// taken for missing data.
private final class ContourDemTileFetcher: DemTileFetcher, @unchecked Sendable {

    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.ephemeral
        var protocols: [AnyClass] = [SliceURLProtocol.self]
        protocols.append(contentsOf: config.protocolClasses ?? [])
        config.protocolClasses = protocols
        session = URLSession(configuration: config)
    }

    /// Called synchronously by the native library; block until the tile request completes.
    func fetch(url: String) throws -> Data? {
        guard let requestUrl = URL(string: url) else { throw FfiError.Tiler(message: "Invalid url \(url)") }
        let semaphore = DispatchSemaphore(value: 0)
        var result: Result<Data?, FfiError> = .success(nil)
        let task = session.dataTask(with: requestUrl) { data, response, error in
            let status = (response as? HTTPURLResponse)?.statusCode
            if status == 200 {
                result = .success(data)
            } else if status != SliceURLProtocol.notFoundStatusCode {
                let reason = error?.localizedDescription ?? "HTTP \(status ?? 0)"
                result = .failure(FfiError.Tiler(message: "Failed to get \(url): \(reason)"))
            }
            semaphore.signal()
        }
        task.resume()
        semaphore.wait()
        return try result.get()
    }
}

