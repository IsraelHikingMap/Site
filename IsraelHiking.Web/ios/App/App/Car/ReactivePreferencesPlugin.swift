import Capacitor
import Foundation

/**
 * Capacitor bridge mirroring `ReactivePreferencesPlugin.kt`. Exposes a generic reactive
 * preferences store to JS: `ReactivePreferences.storeValue({key, value})` persists any value into
 * `CapacitorStore` (so the CarPlay scene, which may run while the web UI is not foregrounded, can
 * read the last known values), and every store change is pushed back to JS listeners by key. The
 * bridge knows nothing about what the keys mean.
 */
@objc(ReactivePreferencesPlugin)
public class ReactivePreferencesPlugin: CAPPlugin, CAPBridgedPlugin, CapacitorStore.Listener {
    public let identifier = "ReactivePreferencesPlugin"
    public let jsName = "ReactivePreferences"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "storeValue", returnType: CAPPluginReturnPromise)
    ]

    private let store = CapacitorStore.shared

    override public func load() {
        store.addListener(self)
    }

    @objc func storeValue(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("key is required")
            return
        }
        guard let value = call.getObject("value") else {
            call.reject("value is required for key=\(key)")
            return
        }
        guard let json = jsonString(from: value) else {
            call.reject("could not serialize value for key=\(key)")
            return
        }

        store.save(key, json)
        call.resolve()
    }

    func onCarStoreUpdated(_ key: String) {
        notifyListeners(key, data: store.load(key))
    }

    private func jsonString(from object: [String: Any]) -> String? {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object),
              let json = String(data: data, encoding: .utf8)
        else { return nil }
        return json
    }
}
