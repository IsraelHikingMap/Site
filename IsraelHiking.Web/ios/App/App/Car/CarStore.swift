import CoreLocation
import Foundation

/**
 * Single source of truth for car-side state. Combines persistent values (style/route/config in
 * UserDefaults) and transient values (location/connected in memory) behind one listener API:
 * subscribers receive a key whenever any value updates, then read the current value back from the
 * store. Mirrors `CarStore.kt` on Android (which uses SharedPreferences) and the NGXS-style
 * "state + select" pattern on the JS side.
 */
final class CarStore {

    protocol Listener: AnyObject {
        func onCarStoreUpdated(_ key: String)
    }

    static let shared = CarStore()

    static let keyStyle = "style"
    static let keyRoute = "route"
    static let keyConfig = "config"
    static let keyLocation = "location"
    static let keyConnected = "connected"

    private static let prefsPrefix = "mapeak_car."
    private static let keyZoom = "zoom"
    private static let keyLastLat = "last_lat"
    private static let keyLastLng = "last_lng"
    private static let defaultLat = 51.5074
    private static let defaultLng = -0.1278

    private let defaults = UserDefaults.standard
    private let lock = NSRecursiveLock()

    private final class WeakListener {
        weak var value: Listener?
        init(_ value: Listener) { self.value = value }
    }
    private var listeners: [WeakListener] = []

    private var locationCache: CLLocation?
    private var connectedCache = false

    private init() {}

    // MARK: - Listeners

    func addListener(_ listener: Listener) {
        lock.lock(); defer { lock.unlock() }
        listeners.removeAll { $0.value == nil || $0.value === listener }
        listeners.append(WeakListener(listener))
    }

    func removeListener(_ listener: Listener) {
        lock.lock(); defer { lock.unlock() }
        listeners.removeAll { $0.value == nil || $0.value === listener }
    }

    private func notifyChanged(_ key: String) {
        DispatchQueue.main.async {
            self.lock.lock()
            let snapshot = self.listeners.compactMap { $0.value }
            self.lock.unlock()
            for listener in snapshot {
                listener.onCarStoreUpdated(key)
            }
        }
    }

    // MARK: - Style

    func saveStyle(_ json: String) {
        defaults.set(json, forKey: Self.prefsPrefix + Self.keyStyle)
        notifyChanged(Self.keyStyle)
    }

    func loadStyle() -> String? {
        defaults.string(forKey: Self.prefsPrefix + Self.keyStyle)
    }

    // MARK: - Routes

    func saveRoutes(_ json: String) {
        defaults.set(json, forKey: Self.prefsPrefix + Self.keyRoute)
        notifyChanged(Self.keyRoute)
    }

    func clearRoutes() {
        defaults.removeObject(forKey: Self.prefsPrefix + Self.keyRoute)
        notifyChanged(Self.keyRoute)
    }

    func loadRoutes() -> [String: Any]? {
        loadJSONObject(Self.keyRoute)
    }

    // MARK: - Config

    func saveConfig(_ json: String) {
        defaults.set(json, forKey: Self.prefsPrefix + Self.keyConfig)
        notifyChanged(Self.keyConfig)
    }

    func loadConfig() -> [String: Any]? {
        loadJSONObject(Self.keyConfig)
    }

    private func loadJSONObject(_ key: String) -> [String: Any]? {
        guard let raw = defaults.string(forKey: Self.prefsPrefix + key),
              let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return obj
    }

    // MARK: - Zoom (persisted, not part of the listener contract)

    func saveZoom(_ zoom: Double) {
        defaults.set(zoom, forKey: Self.prefsPrefix + Self.keyZoom)
    }

    func loadZoom() -> Double {
        if defaults.object(forKey: Self.prefsPrefix + Self.keyZoom) == nil { return 14.0 }
        return defaults.double(forKey: Self.prefsPrefix + Self.keyZoom)
    }

    // MARK: - Location

    func setLocation(_ location: CLLocation?) {
        locationCache = location
        if let location = location {
            defaults.set(location.coordinate.latitude, forKey: Self.prefsPrefix + Self.keyLastLat)
            defaults.set(location.coordinate.longitude, forKey: Self.prefsPrefix + Self.keyLastLng)
        }
        notifyChanged(Self.keyLocation)
    }

    func getLocation() -> CLLocation? { locationCache }

    /**
     * Last lat/lng we ever received from GPS, used to center the map on launch before a fresh fix
     * arrives. Falls back to London on a cold install with no saved fix so the map never opens at
     * (0, 0). The returned coordinate has no speed/bearing/accuracy and must not feed ETA.
     */
    func loadLastKnownLocation() -> CLLocationCoordinate2D {
        let lat = defaults.object(forKey: Self.prefsPrefix + Self.keyLastLat) as? Double ?? Self.defaultLat
        let lng = defaults.object(forKey: Self.prefsPrefix + Self.keyLastLng) as? Double ?? Self.defaultLng
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    // MARK: - Connected

    func setConnected(_ connected: Bool) {
        if connectedCache == connected { return }
        connectedCache = connected
        notifyChanged(Self.keyConnected)
    }

    func isConnected() -> Bool { connectedCache }
}
