import CoreLocation
import Foundation

/**
 * Mirrors `CarBackendService.kt`: a thin client over the Mapeak backend so the CarPlay experience
 * can search for places and compute point-to-point routes without going through the web layer.
 * Mirrors the endpoints used by the Angular app (see search-results.provider.ts /
 * routing.provider.ts): all results are delivered back on the main queue so callers can update
 * car templates directly.
 */
final class CarBackendService {

    private let valhallaTiles = ValhallaTiles()
    private lazy var valhallaRouter = ValhallaRouter(tiles: valhallaTiles)

    /**
     * Search for places matching `query` near `center`. Mirrors GET /api/search/{term}. Results are
     * capped to `maxResults` so they fit the car list.
     */
    func search(query: String,
                center: CLLocationCoordinate2D?,
                zoom: Double,
                language: String,
                onResult: @escaping ([CarSearchResult]) -> Void) {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard term.count > 2 else {
            onResult([])
            return
        }
        guard var components = URLComponents(string: Self.apiBase + "search/"
            + (term.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? term)) else {
            onResult([])
            return
        }
        var items = [URLQueryItem(name: "language", value: language),
                     URLQueryItem(name: "prefix", value: "false")]
        if let center = center {
            items.append(URLQueryItem(name: "lat", value: String(center.latitude)))
            items.append(URLQueryItem(name: "lng", value: String(center.longitude)))
            items.append(URLQueryItem(name: "zoom", value: String(zoom)))
        }
        components.queryItems = items
        guard let url = components.url else {
            onResult([])
            return
        }
        Self.session.dataTask(with: url) { data, _, error in
            if let error = error {
                NSLog("[CarBackendService] Search failed for '\(term)': \(error.localizedDescription)")
            }
            Self.onMain(onResult, Self.parseSearchResults(data))
        }.resume()
    }

    /**
     * Compute a route from `from` to `to` using the given `routingType`. Mirrors GET /api/routing.
     * When the backend call fails the route is calculated on the device from the offline routing
     * tiles, and only if those are missing or cannot produce a route does it fall back to a straight
     * line between the two points, so the user always gets a usable destination on the map.
     */
    func route(from: CLLocationCoordinate2D,
               to: CLLocationCoordinate2D,
               routingType: String,
               onResult: @escaping ([CLLocationCoordinate2D]) -> Void) {
        var components = URLComponents(string: Self.apiBase + "routing")!
        components.queryItems = [
            URLQueryItem(name: "from", value: "\(from.latitude),\(from.longitude)"),
            URLQueryItem(name: "to", value: "\(to.latitude),\(to.longitude)"),
            URLQueryItem(name: "type", value: routingType)
        ]
        guard let url = components.url else {
            onResult([from, to])
            return
        }
        Self.session.dataTask(with: url) { [weak self] data, _, error in
            if let error = error {
                NSLog("[CarBackendService] Routing failed: \(error.localizedDescription)")
            }
            let route = Self.parseRoute(data)
                ?? self?.offlineRoute(from: from, to: to, routingType: routingType)
                ?? [from, to]
            Self.onMain(onResult, route)
        }.resume()
    }

    /**
     * Fetch turn-by-turn instructions for an existing route by map-matching its `points` to the
     * network. Mirrors POST /api/routing with the routing type, language and the v2 instructions
     * format as query parameters and the points as the JSON body. When the backend call fails or
     * carries no instructions the points are matched on the device against the offline routing
     * tiles, and only if those are missing or cannot match them does it return an empty list, so
     * that the caller keeps its locally-synthesized turns.
     */
    func mapMatch(points: [CLLocationCoordinate2D],
                  routingType: String,
                  language: String,
                  onResult: @escaping ([CarManeuver]) -> Void) {
        guard points.count >= 2 else {
            onResult([])
            return
        }
        // A recorded route holds a point every few meters, far denser than map matching needs and
        // more than fits in a request. Simplifying keeps the corners the instructions are read from.
        let pointsToMatch = SpatialHelper.simplify(points, toleranceMeters: Self.mapMatchToleranceMeters)
        var components = URLComponents(string: Self.apiBase + "routing")!
        components.queryItems = [
            URLQueryItem(name: "type", value: routingType),
            URLQueryItem(name: "language", value: language),
            URLQueryItem(name: "instructionsFormat", value: "v2")
        ]
        let body = pointsToMatch.map { ["lat": $0.latitude, "lng": $0.longitude] }
        guard let url = components.url,
              let payload = try? JSONSerialization.data(withJSONObject: body) else {
            onResult([])
            return
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = payload
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        Self.session.dataTask(with: request) { [weak self] data, _, error in
            if let error = error {
                NSLog("[CarBackendService] Map match failed: \(error.localizedDescription)")
            }
            var maneuvers = Self.parseManeuvers(data)
            if maneuvers.isEmpty {
                maneuvers = self?.offlineMapMatch(points: points, routingType: routingType,
                                                  language: language) ?? []
            }
            Self.onMain(onResult, maneuvers)
        }.resume()
    }

    /**
     * Calculate the route on the device from the tiles the user downloaded for offline use. Returns
     * nil when there are no tiles, or when valhalla cannot connect the two points, so the caller can
     * fall back to a straight line. Called from URLSession's queues, never the main one.
     */
    private func offlineRoute(from: CLLocationCoordinate2D,
                              to: CLLocationCoordinate2D,
                              routingType: String) -> [CLLocationCoordinate2D]? {
        guard valhallaTiles.hasTiles() else { return nil }
        do {
            let json = try valhallaRouter.route(ValhallaRouteRequest(
                fromLat: from.latitude, fromLng: from.longitude,
                toLat: to.latitude, toLng: to.longitude,
                profile: Self.profile(routingType), elevationInterval: 0))
            return Self.decodeShape(json)
        } catch {
            NSLog("[CarBackendService] Offline routing failed: \(error)")
            return nil
        }
    }

    /**
     * Match the route's points to the road network on the device, so that a route that was already
     * calculated still gets real turn by turn instructions when the backend is unreachable. Returns
     * an empty list when there are no tiles, or when valhalla cannot match the points, so that the
     * caller keeps the turns it synthesized from the geometry.
     */
    private func offlineMapMatch(points: [CLLocationCoordinate2D],
                                 routingType: String,
                                 language: String) -> [CarManeuver] {
        guard valhallaTiles.hasTiles() else { return [] }
        do {
            let response = try valhallaRouter.traceRoute(ValhallaTraceRequest(
                points: points, profile: Self.profile(routingType), language: language))
            return CarManeuver.fromValhallaManeuvers(response.trip.legs.flatMap { $0.maneuvers })
        } catch {
            NSLog("[CarBackendService] Offline map match failed: \(error)")
            return []
        }
    }

    /// The routing profile of the routing type, as the profiles are named in the profiles file, so
    /// that the offline route uses the same costing options the server would have used.
    private static func profile(_ routingType: String) -> String {
        switch routingType {
        case "Hike": return "foot"
        case "Bike": return "bike"
        case "4WD": return "car4WheelDrive"
        default: return "default"
        }
    }

    /// The geometry of a valhalla trip: every leg carries its own encoded polyline, and they follow
    /// one another. Nil when there is nothing to draw, so the caller can fall back.
    private static func decodeShape(_ json: String) -> [CLLocationCoordinate2D]? {
        guard let data = json.data(using: .utf8),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let trip = root["trip"] as? [String: Any],
              let legs = trip["legs"] as? [[String: Any]]
        else { return nil }
        var points: [CLLocationCoordinate2D] = []
        for leg in legs {
            guard let shape = leg["shape"] as? String, !shape.isEmpty else { continue }
            points.append(contentsOf: decodePolyline(shape, precision: polylinePrecision))
        }
        return points.isEmpty ? nil : points
    }

    /// Decodes an encoded polyline at the given precision, the same encoding valhalla returns.
    private static func decodePolyline(_ encoded: String, precision: Int) -> [CLLocationCoordinate2D] {
        var coordinates: [CLLocationCoordinate2D] = []
        let factor = pow(10.0, Double(precision))
        var index = encoded.startIndex
        var lat = 0
        var lng = 0
        while index < encoded.endIndex {
            var result = 0
            var shift = 0
            var byte = 0
            repeat {
                guard index < encoded.endIndex else { return coordinates }
                byte = Int(encoded[index].asciiValue ?? 0) - 63
                index = encoded.index(after: index)
                result |= (byte & 0x1F) << shift
                shift += 5
            } while byte >= 0x20
            lat += (result & 1) != 0 ? ~(result >> 1) : (result >> 1)

            result = 0
            shift = 0
            repeat {
                guard index < encoded.endIndex else { return coordinates }
                byte = Int(encoded[index].asciiValue ?? 0) - 63
                index = encoded.index(after: index)
                result |= (byte & 0x1F) << shift
                shift += 5
            } while byte >= 0x20
            lng += (result & 1) != 0 ? ~(result >> 1) : (result >> 1)

            coordinates.append(CLLocationCoordinate2D(latitude: Double(lat) / factor,
                                                      longitude: Double(lng) / factor))
        }
        return coordinates
    }

    private static func parseSearchResults(_ data: Data?) -> [CarSearchResult] {
        guard let data = data, !data.isEmpty,
              let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else { return [] }
        var results: [CarSearchResult] = []
        for item in array where results.count < maxResults {
            guard let location = item["location"] as? [String: Any] else { continue }
            let displayName = (item["displayName"] as? String) ?? ""
            let title = displayName.isEmpty ? ((item["title"] as? String) ?? "") : displayName
            results.append(CarSearchResult(
                title: title,
                subtitle: (item["description"] as? String) ?? "",
                location: CLLocationCoordinate2D(
                    latitude: (location["lat"] as? NSNumber)?.doubleValue ?? 0,
                    longitude: (location["lng"] as? NSNumber)?.doubleValue ?? 0)))
        }
        return results
    }

    private static func parseManeuvers(_ data: Data?) -> [CarManeuver] {
        guard let properties = firstFeatureProperties(data),
              let instructions = properties["instructions"] as? [[String: Any]]
        else { return [] }
        return CarManeuver.fromInstructions(instructions)
    }

    /// Parse the route geometry out of a GeoJSON FeatureCollection response. GeoJSON coordinates are
    /// ordered [lng, lat, (alt)], so they are swapped into CLLocationCoordinate2D's lat/lng order.
    private static func parseRoute(_ data: Data?) -> [CLLocationCoordinate2D]? {
        guard let data = data, !data.isEmpty,
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let features = root["features"] as? [[String: Any]],
              let geometry = features.first?["geometry"] as? [String: Any],
              let coordinates = geometry["coordinates"] as? [[Double]]
        else { return nil }
        let points = coordinates.compactMap { coordinate -> CLLocationCoordinate2D? in
            guard coordinate.count >= 2 else { return nil }
            return CLLocationCoordinate2D(latitude: coordinate[1], longitude: coordinate[0])
        }
        return points.isEmpty ? nil : points
    }

    private static func firstFeatureProperties(_ data: Data?) -> [String: Any]? {
        guard let data = data, !data.isEmpty,
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let features = root["features"] as? [[String: Any]]
        else { return nil }
        return features.first?["properties"] as? [String: Any]
    }

    private static func onMain<T>(_ onResult: @escaping (T) -> Void, _ value: T) {
        DispatchQueue.main.async { onResult(value) }
    }

    private static let session = URLSession(configuration: .default)
    private static let apiBase = "https://mapeak.com/api/"
    private static let maxResults = 6
    private static let polylinePrecision = 6

    /// How far a point may sit from the line its neighbours draw and still be dropped before map
    /// matching. Below the width of the roads being matched against, so the turns survive.
    private static let mapMatchToleranceMeters = 10.0
}
