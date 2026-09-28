import CoreLocation
import Foundation

/// Feeds GPS fixes into `CarStore`. Mirrors `CarLocationProvider.kt` (which uses fused location on
/// Android). Reuses the app's existing location authorization — the usage strings already live in
/// Info.plist and the phone app requests permission during normal use.
final class CarLocationProvider: NSObject, CLLocationManagerDelegate {

    private let manager = CLLocationManager()
    private let store = CapacitorStore.shared
    private var started = false

    /// Configures the manager for navigation, delivering every computed fix rather than gating on
    /// distance, so CarPlay follows as smoothly as the phone app does.
    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.distanceFilter = kCLDistanceFilterNone
        manager.activityType = .automotiveNavigation
    }

    /// Starts the updates, asking for permission first: CarPlay can connect before the phone app
    /// has ever prompted for it.
    func start() {
        if started { return }
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
