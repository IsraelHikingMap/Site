import Foundation
import Valhalla
import ValhallaConfigModels

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
        let config = try ValhallaConfig(tilesDir: tiles.tilesURL)
        let engine = try Valhalla(config)
        valhalla = engine
        return engine
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
