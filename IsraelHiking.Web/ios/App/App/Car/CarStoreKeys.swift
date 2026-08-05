import Foundation

/**
 * Well-known keys exchanged through `CapacitorStore`. style/route/config mirror the string keys
 * sent from the web layer via the ReactivePreferences plugin and must not change. location is
 * produced on the native side and broadcast to listeners. zoom/lastLat/lastLng are persisted-only
 * and are never part of the listener contract. Mirrors `CarStoreKeys.kt` on Android.
 */
enum CarStoreKeys {
    static let style = "style"
    static let route = "route"
    static let config = "config"
    static let location = "location"
    static let zoom = "zoom"
    static let lastLat = "last_lat"
    static let lastLng = "last_lng"
}
