import CoreLocation
import Foundation
import Valhalla
import ValhallaConfigModels
import ValhallaModels

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

/**
 * A map match request: the recorded points to snap onto the road network, and the profile whose
 * costing they are snapped with. `language` picks the language the instructions come back in.
 * Mirrors `ValhallaTraceRequest` in `ValhallaRouter.kt`.
 */
struct ValhallaTraceRequest {
    let points: [CLLocationCoordinate2D]
    let profile: String
    let language: String?
}

enum ValhallaRouterError: Error {
    case responseEncodingFailed
    case profileNotFound(String)
    case unknownCosting(String)
}

/**
 * Runs route requests against the native valhalla engine, mirroring `ValhallaRouter.kt`.
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
     * Returns the valhalla response json - the web layer decodes the shape and the elevation.
     */
    func route(_ request: ValhallaRouteRequest) throws -> String {
        let response = try engine().route(request: try routeRequest(request))
        guard let json = String(data: try JSONEncoder().encode(response), encoding: .utf8) else {
            throw ValhallaRouterError.responseEncodingFailed
        }
        return json
    }

    /**
     * Matches recorded points onto the road network, so a route that was already calculated still
     * gets real turn-by-turn instructions when the backend is unreachable. Returns valhalla's own
     * maneuvers, which the caller converts the same way the backend converts its own.
     */
    func traceRoute(_ request: ValhallaTraceRequest) throws -> MapMatchRouteResponse {
        try engine().traceRoute(request: try mapMatchRequest(request))
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
        let engine = try Valhalla(try engineConfiguration())
        valhalla = engine
        return engine
    }

    /**
     * The configuration the engine is run with: the defaults the routing library ships alongside the
     * engine itself - so they are always the ones that engine expects - with the one thing they can not
     * know, where the tiles are on this device, filled in.
     */
    private func engineConfiguration() throws -> ValhallaConfig {
        try ValhallaConfig(tilesDir: tiles.tilesURL)
    }

    private func routeRequest(_ request: ValhallaRouteRequest) throws -> RouteRequest {
        // Without the profiles there is no offline routing, the same as without tiles
        guard let profile = profiles.profile(named: request.profile) else {
            throw ValhallaRouterError.profileNotFound(request.profile)
        }
        guard let costing = CostingModel(rawValue: profile.costing) else {
            throw ValhallaRouterError.unknownCosting(profile.costing)
        }
        return RouteRequest(
            locations: [
                RoutingWaypoint(lat: request.fromLat, lon: request.fromLng),
                RoutingWaypoint(lat: request.toLat, lon: request.toLng)
            ],
            costing: costing,
            costingOptions: try costingOptions(costing, profile.costingOptions),
            units: .km,
            elevationInterval: Double(request.elevationInterval)
        )
    }

    private func mapMatchRequest(_ request: ValhallaTraceRequest) throws -> MapMatchRequest {
        guard let profile = profiles.profile(named: request.profile) else {
            throw ValhallaRouterError.profileNotFound(request.profile)
        }
        guard let costing = CostingModel(rawValue: profile.costing) else {
            throw ValhallaRouterError.unknownCosting(profile.costing)
        }
        guard let matchCosting = MapMatchCostingModel(rawValue: profile.costing) else {
            throw ValhallaRouterError.unknownCosting(profile.costing)
        }
        let lastIndex = request.points.count - 1
        return MapMatchRequest(
            // Only the ends are break points, so that the trace comes back as a single leg with one
            // depart and one arrive, and the rest are snapped through - as the server asks for it
            shape: request.points.enumerated().map { index, point in
                MapMatchWaypoint(
                    lat: point.latitude,
                    lon: point.longitude,
                    type: index == 0 || index == lastIndex ? ._break : .via)
            },
            costing: matchCosting,
            costingOptions: try costingOptions(costing, profile.costingOptions),
            shapeMatch: .mapSnap,
            directionsOptions: DirectionsOptions(units: .km, language: language(request.language))
        )
    }

    /// The closest language valhalla knows to the one asked for, falling back to the base language
    /// of a regional code, and to valhalla's own default when it knows neither.
    private func language(_ language: String?) -> ValhallaLanguages? {
        guard let language = language else { return nil }
        if let exact = ValhallaLanguages(rawValue: language) {
            return exact
        }
        let base = language.split(separator: "-").first.map(String.init) ?? language
        return ValhallaLanguages.allCases.first { $0.rawValue.split(separator: "-").first.map(String.init) == base }
    }

    /**
     * The options of a profile belong to the costing model they were written for, so they are read
     * into the options of that model.
     */
    private func costingOptions(_ costing: CostingModel, _ options: [String: Any]?) throws -> CostingOptions? {
        guard let options else {
            return nil
        }
        let data = try JSONSerialization.data(withJSONObject: options)
        switch costing {
        case .pedestrian:
            return CostingOptions(pedestrian: try JSONDecoder().decode(PedestrianCostingOptions.self, from: data))
        case .bicycle:
            return CostingOptions(bicycle: try JSONDecoder().decode(BicycleCostingOptions.self, from: data))
        case .auto:
            return CostingOptions(auto: try JSONDecoder().decode(AutoCostingOptions.self, from: data))
        default:
            throw ValhallaRouterError.unknownCosting(costing.rawValue)
        }
    }
}
