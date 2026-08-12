import Foundation
import Valhalla
import ValhallaConfigModels

/**
 * A route request, `costingOptions` is a valhalla costing_options object keyed by costing name,
 * i.e. {"pedestrian": {...}}, so that the offline route matches the one the server would return.
 * An `elevationInterval` of 0 means no elevation is requested.
 */
struct ValhallaRouteRequest {
    let fromLat: Double
    let fromLng: Double
    let toLat: Double
    let toLng: Double
    let costing: String
    let costingOptions: [String: Any]?
    let elevationInterval: Int
}

enum ValhallaRouterError: Error {
    case requestEncodingFailed
}

/**
 * Runs route requests against the native valhalla engine, mirroring `ValhallaRouter.kt`.
 *
 * Unlike android, where the raw entry point is internal and has to be reached by reflection, the
 * swift package exposes `route(rawRequest:)`, so the raw json - including the elevation, which the
 * typed models do not carry yet - is available directly.
 */
final class ValhallaRouter {
    private let tiles: ValhallaTiles
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
        var json: [String: Any] = [
            "locations": [
                ["lat": request.fromLat, "lon": request.fromLng],
                ["lat": request.toLat, "lon": request.toLng]
            ],
            "costing": request.costing,
            "directions_options": ["units": "kilometers"]
        ]
        if let costingOptions = request.costingOptions {
            json["costing_options"] = costingOptions
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
