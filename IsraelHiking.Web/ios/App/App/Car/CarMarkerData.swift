import CoreLocation
import Foundation

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
