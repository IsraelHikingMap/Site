import CoreLocation
import Foundation

/// Mirrors `CarRouteData.kt`: one planned route as fed from JS via `Car.storeValue`.
struct CarRouteData {
    let coordinates: [CLLocationCoordinate2D]
    let weight: Double
    let color: String?
    let opacity: Double
    let markers: [CarMarkerData]

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
            markers: markers
        )
    }

    /// Parses the `{ routes: [...] }` payload stored under `CarStoreKeys.route`.
    static func list(from payload: [String: Any]?) -> [CarRouteData] {
        guard let routes = payload?["routes"] as? [[String: Any]] else { return [] }
        return routes.compactMap { from($0) }
    }
}

/// A private route point (POI), mirroring `CarMarkerData.kt`: `{ latlng: [lng, lat], title }`.
struct CarMarkerData {
    let coordinate: CLLocationCoordinate2D
    let title: String

    static func from(_ json: [String: Any]) -> CarMarkerData? {
        guard let pair = json["latlng"] as? [Any], pair.count >= 2,
              let lng = (pair[0] as? NSNumber)?.doubleValue,
              let lat = (pair[1] as? NSNumber)?.doubleValue
        else { return nil }
        return CarMarkerData(
            coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng),
            title: (json["title"] as? String) ?? ""
        )
    }
}
