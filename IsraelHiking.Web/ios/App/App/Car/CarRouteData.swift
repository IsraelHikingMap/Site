import CoreLocation
import Foundation

/// Mirrors `CarRouteData.kt`: one planned route as fed from JS via `Car.storeValue`.
struct CarRouteData {
    let coordinates: [CLLocationCoordinate2D]
    let weight: Double
    let color: String?
    let opacity: Double
    let markers: [CarMarkerData]

    /// The distance in meters from the start of the route to each of its points. Measured once,
    /// since it only changes when the route does, while the GPS position is matched against the
    /// route on every fix.
    let distancesAlongRouteMeters: [Double]

    /// The length of the whole route in meters.
    var lengthMeters: Double { distancesAlongRouteMeters.last ?? 0 }

    private static func distancesAlongRoute(_ coordinates: [CLLocationCoordinate2D]) -> [Double] {
        var distances = [Double](repeating: 0, count: coordinates.count)
        for index in 1..<max(coordinates.count, 1) {
            distances[index] = distances[index - 1]
                + SpatialService.distanceMeters(coordinates[index - 1], coordinates[index])
        }
        return distances
    }

    /// Parses a single `{ points: [[lng, lat], ...], weight, color, opacity, markers }` object.
    static func from(_ json: [String: Any]) -> CarRouteData? {
        guard let points = json["points"] as? [[Any]] else { return nil }
        let coordinates: [CLLocationCoordinate2D] = points.compactMap { pair in
            guard pair.count >= 2,
                  let lng = (pair[0] as? NSNumber)?.doubleValue,
                  let lat = (pair[1] as? NSNumber)?.doubleValue
            else { return nil }
            return CLLocationCoordinate2D(latitude: lat, longitude: lng)
        }
        let markers = (json["markers"] as? [[String: Any]])?.compactMap(CarMarkerData.from) ?? []
        return CarRouteData(
            coordinates: coordinates,
            weight: (json["weight"] as? NSNumber)?.doubleValue ?? 0,
            color: json["color"] as? String,
            opacity: (json["opacity"] as? NSNumber)?.doubleValue ?? 0,
            markers: markers,
            distancesAlongRouteMeters: distancesAlongRoute(coordinates)
        )
    }

    /// Parses the `{ routes: [...] }` payload stored under `CarStoreKeys.route`.
    static func list(from payload: [String: Any]?) -> [CarRouteData] {
        guard let routes = payload?["routes"] as? [[String: Any]] else { return [] }
        return routes.compactMap { from($0) }
    }
}
