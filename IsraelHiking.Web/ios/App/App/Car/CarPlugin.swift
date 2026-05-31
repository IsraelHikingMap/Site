import Capacitor
import Foundation

/**
 * Capacitor bridge mirroring `CarPlugin.kt`. The JS `CarService` calls `Car.storeValue({key, value})`
 * with key `style` | `route` | `config`; we persist it into `CarStore` so the CarPlay scene (which
 * may run while the web UI is not foregrounded) can read the last known values.
 */
@objc(CarPlugin)
public class CarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CarPlugin"
    public let jsName = "Car"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "storeValue", returnType: CAPPluginReturnPromise)
    ]

    private let store = CarStore.shared

    @objc func storeValue(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("key is required")
            return
        }
        guard let value = call.getObject("value") else {
            call.reject("value is required for key=\(key)")
            return
        }

        switch key {
        case CarStore.keyStyle:
            var style = value as [String: Any]
            addLayeringAnchor(to: &style)
            guard let json = jsonString(from: style) else {
                call.reject("could not serialize style")
                return
            }
            store.saveStyle(json)
        case CarStore.keyRoute:
            let routes = value["routes"] as? [Any]
            if let routes = routes, routes.isEmpty {
                store.clearRoutes()
            } else {
                guard let json = jsonString(from: value) else {
                    call.reject("could not serialize route")
                    return
                }
                store.saveRoutes(json)
            }
        case CarStore.keyConfig:
            guard let json = jsonString(from: value) else {
                call.reject("could not serialize config")
                return
            }
            store.saveConfig(json)
        default:
            call.reject("unknown key: \(key)")
            return
        }
        call.resolve()
    }

    private func jsonString(from object: [String: Any]) -> String? {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object),
              let json = String(data: data, encoding: .utf8)
        else { return nil }
        return json
    }

    /// Injects the hidden anchor source + layer used for deterministic layer ordering on the car map.
    private func addLayeringAnchor(to style: inout [String: Any]) {
        var sources = style["sources"] as? [String: Any] ?? [:]
        sources[CarMapViewController.layeringAnchorSourceId] = [
            "type": "geojson",
            "data": ["type": "FeatureCollection", "features": []]
        ]
        style["sources"] = sources

        var layers = style["layers"] as? [[String: Any]] ?? []
        layers.append([
            "id": CarMapViewController.layeringAnchorId,
            "type": "circle",
            "source": CarMapViewController.layeringAnchorSourceId,
            "layout": ["visibility": "none"]
        ])
        style["layers"] = layers
    }
}
