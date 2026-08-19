import Foundation
import Valhalla

/**
 * A route request. The costing model and its options are taken from the stored profile named
 * `profile`, so that the offline route matches the one the server would return.
 * An `elevationInterval` of 0 means no elevation is requested.
 */
struct ValhallaRouteRequest {
    let fromLat: Double
    let fromLng: Double
    let toLat: Double
    let toLng: Double
    let profile: String
    let elevationInterval: Int
}

enum ValhallaRouterError: Error {
    case requestEncodingFailed
    case profileNotFound(String)
    case configurationNotDownloaded
}

/**
 * Runs route requests against the native valhalla engine, mirroring `ValhallaRouter.kt`.
 *
 * Android builds the request with the typed models, which is what this should do too, but the
 * swift models cannot be used for it yet: valhalla-mobile pins them to `.upToNextMinor(from:
 * "0.2.0")`, and `elevation_interval` only exists from 0.4.0, so a typed request here would come
 * back without the elevation. Until that pin is widened the request is built as json and sent
 * through `route(rawRequest:)`, which is a public part of the package - no workaround involved.
 */
final class ValhallaRouter {
    /// The plugin's own copy, the app hands it the file it downloaded
    private static let configurationFileName = "valhalla_configuration.json"
    /// The configuration the engine is run with, the downloaded one with the tiles directory in it
    private static let engineConfigurationFileName = "valhalla.json"
    private static let mjolnirKey = "mjolnir"
    private static let tileDirKey = "tile_dir"

    private let tiles: ValhallaTiles
    private let profiles = ValhallaProfiles()
    /// Holds the tiles open between requests, it is dropped whenever the tiles on disk change
    private var valhalla: Valhalla?

    init(tiles: ValhallaTiles) {
        self.tiles = tiles
    }

    /**
     * Returns the raw valhalla response json - the web layer decodes the shape and the elevation.
     */
    func route(_ request: ValhallaRouteRequest) throws -> String {
        let engine = try engine()
        return engine.route(rawRequest: try requestJson(request))
    }

    /**
     * Called when tiles are added or removed, the next request opens them again.
     */
    func invalidate() {
        valhalla = nil
    }

    private func engine() throws -> Valhalla {
        if let valhalla {
            return valhalla
        }
        let engine = try Valhalla(configPath: try engineConfigurationPath())
        valhalla = engine
        return engine
    }

    /**
     * Keeps the configuration as it was downloaded, it is only read when a route is calculated.
     */
    func storeConfiguration(_ configuration: String) throws {
        // Fail here rather than when routing, so that content that can not be read is never kept
        guard let data = configuration.data(using: .utf8),
              (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] != nil else {
            throw ValhallaRouterError.configurationNotDownloaded
        }
        try data.write(to: dataURL().appendingPathComponent(ValhallaRouter.configurationFileName), options: .atomic)
    }

    private func dataURL() -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    /**
     * The configuration the engine is run with: the one that was downloaded with the offline maps,
     * which is the very same one the server runs with, with the only thing it can not know - where
     * the tiles are on this device - filled in. Without it, as without tiles, there is no offline
     * routing.
     *
     * It is written on every request rather than kept, so that a configuration that was downloaded
     * again takes effect without having to notice that it changed.
     */
    private func engineConfigurationPath() throws -> String {
        let downloadedURL = dataURL().appendingPathComponent(ValhallaRouter.configurationFileName)
        guard let data = try? Data(contentsOf: downloadedURL),
              var config = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              var mjolnir = config[ValhallaRouter.mjolnirKey] as? [String: Any] else {
            throw ValhallaRouterError.configurationNotDownloaded
        }
        mjolnir[ValhallaRouter.tileDirKey] = tiles.tilesURL.path
        config[ValhallaRouter.mjolnirKey] = mjolnir
        let engineURL = dataURL().appendingPathComponent(ValhallaRouter.engineConfigurationFileName)
        try JSONSerialization.data(withJSONObject: config).write(to: engineURL, options: .atomic)
        return engineURL.path
    }

    private func requestJson(_ request: ValhallaRouteRequest) throws -> String {
        // Without the profiles there is no offline routing, the same as without tiles
        guard let profile = profiles.profile(named: request.profile) else {
            throw ValhallaRouterError.profileNotFound(request.profile)
        }
        let costing = profile.costing
        var json: [String: Any] = [
            "locations": [
                ["lat": request.fromLat, "lon": request.fromLng],
                ["lat": request.toLat, "lon": request.toLng]
            ],
            "costing": costing,
            "directions_options": ["units": "kilometers"]
        ]
        // Valhalla takes the options under the name of the costing model they belong to
        if let costingOptions = profile.costingOptions {
            json["costing_options"] = [costing: costingOptions]
        }
        if request.elevationInterval > 0 {
            json["elevation_interval"] = request.elevationInterval
        }
        let data = try JSONSerialization.data(withJSONObject: json)
        guard let requestJson = String(data: data, encoding: .utf8) else {
            throw ValhallaRouterError.requestEncodingFailed
        }
        return requestJson
    }
}
