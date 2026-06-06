import CoreLocation
import Foundation

/// Feeds GPS fixes into `CarStore`. Mirrors `CarLocationProvider.kt` (which uses fused location on
/// Android). Reuses the app's existing location authorization — the usage strings already live in
/// Info.plist and the phone app requests permission during normal use.
final class CarLocationProvider: NSObject, CLLocationManagerDelegate {

    private let manager = CLLocationManager()
    private let store = CapacitorStore.shared
    private var started = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        // Deliver every computed fix (no 5 m gate) so CarPlay follows as smoothly as the phone app.
        manager.distanceFilter = kCLDistanceFilterNone
        manager.activityType = .automotiveNavigation
    }

    func start() {
        if started { return }
        // CarPlay can connect before the phone app has prompted for permission.
        if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }
        manager.startUpdatingLocation()
        started = true
    }

    func stop() {
        if !started { return }
        manager.stopUpdatingLocation()
        started = false
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let last = locations.last {
            publishLocation(last)
        }
    }

    /// Broadcast the latest fix to listeners and persist its coordinates so the map can re-center on
    /// the last known position after a cold start, before a fresh fix arrives.
    private func publishLocation(_ location: CLLocation) {
        store.setTransient(CarStoreKeys.location, location)
        store.saveDouble(CarStoreKeys.lastLat, location.coordinate.latitude)
        store.saveDouble(CarStoreKeys.lastLng, location.coordinate.longitude)
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        if started, status == .authorizedWhenInUse || status == .authorizedAlways {
            manager.startUpdatingLocation()
        }
    }
}
