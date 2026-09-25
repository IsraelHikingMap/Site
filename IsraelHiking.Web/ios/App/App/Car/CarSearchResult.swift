import CoreLocation
import Foundation

/// Mirrors `CarSearchResult.kt`: a single search result returned by the backend search API,
/// reduced to what the car UI needs.
struct CarSearchResult {
    let title: String
    let subtitle: String
    let location: CLLocationCoordinate2D
}
