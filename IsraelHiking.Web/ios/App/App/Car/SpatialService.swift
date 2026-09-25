import CoreLocation
import Foundation

/// Mirrors `SpatialService.kt`, and the web client's SpatialService: the spatial calculations the
/// car experience measures routes with, kept off
/// `CLLocation.distance(from:)`, which allocates two objects per call - a route with tens of
/// thousands of points cannot afford that when it is re-measured on every GPS fix.
/// The Kotlin side carries a little more, for the map matching that only Android does.
enum SpatialService {

    /// Good enough for the local, flat plane calculations, the earth is not a perfect sphere anyway.
    static let metersPerLatitudeDegree = 111_320.0

    private static let earthRadiusMeters = 6_371_008.8

    /// How many meters a degree of longitude is worth at the given latitude.
    static func metersPerLongitudeDegree(atLatitude latitude: Double) -> Double {
        metersPerLatitudeDegree * cos(latitude * .pi / 180)
    }

    /// The distance in meters between two positions, measured on the sphere. Used for the distances
    /// along a route, which are measured once per route and have to hold over its whole length.
    static func distanceMeters(_ from: CLLocationCoordinate2D, _ to: CLLocationCoordinate2D) -> Double {
        let fromLatitude = from.latitude * .pi / 180
        let toLatitude = to.latitude * .pi / 180
        let latitudeDelta = (to.latitude - from.latitude) * .pi / 180
        let longitudeDelta = (to.longitude - from.longitude) * .pi / 180
        let a = sin(latitudeDelta / 2) * sin(latitudeDelta / 2)
            + cos(fromLatitude) * cos(toLatitude) * sin(longitudeDelta / 2) * sin(longitudeDelta / 2)
        return 2 * earthRadiusMeters * asin(min(a.squareRoot(), 1))
    }

    /// The bearing in degrees within [0, 360) from one position to another.
    static func bearingDegrees(_ from: CLLocationCoordinate2D, _ to: CLLocationCoordinate2D) -> Double {
        let fromLatitude = from.latitude * .pi / 180
        let toLatitude = to.latitude * .pi / 180
        let longitudeDelta = (to.longitude - from.longitude) * .pi / 180
        let y = sin(longitudeDelta) * cos(toLatitude)
        let x = cos(fromLatitude) * sin(toLatitude) - sin(fromLatitude) * cos(toLatitude) * cos(longitudeDelta)
        return (atan2(y, x) * 180 / .pi + 360).truncatingRemainder(dividingBy: 360)
    }

    /// Smallest absolute difference between two bearings, in degrees within [0, 180].
    static func angleDifference(_ a: Double, _ b: Double) -> Double {
        let difference = abs(a - b).truncatingRemainder(dividingBy: 360)
        return difference > 180 ? 360 - difference : difference
    }
}
