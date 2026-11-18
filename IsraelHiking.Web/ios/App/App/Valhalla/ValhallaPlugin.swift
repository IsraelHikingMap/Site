import Capacitor
import Foundation

/// Offline routing using the native Valhalla engine against tiles that were downloaded and extracted
/// on the device. The capacitor bridge mirrors `ValhallaPlugin.kt` method for method.
///
/// This is a self contained plugin so that it can later be moved out into its own capacitor plugin -
/// it must not depend on anything else in the app.
@objc(ValhallaPlugin)
public class ValhallaPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ValhallaPlugin"
    public let jsName = "Valhalla"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "extractFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storeProfiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listIds", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteById", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "route", returnType: CAPPluginReturnPromise)
    ]

    private let tiles = ValhallaTiles()
    private let profiles = ValhallaProfiles()
    private lazy var router = ValhallaRouter(tiles: tiles)

    /// Extracts a downloaded file of routing tiles into the shared tiles directory.
    /// Extracting the files of several adjacent areas into it is the way to route across them.
    /// The tiles it held are kept under the given id, so that they can later be removed on their own.
    @objc func extractFile(_ call: CAPPluginCall) {
        guard let tarFileName = call.getString("tarFileName"), !tarFileName.isEmpty else {
            call.reject("tarFileName is required")
            return
        }
        guard let id = call.getString("id"), !id.isEmpty else {
            call.reject("id is required")
            return
        }
        do {
            let result = try tiles.extract(tarFileName: tarFileName, id: id)
            router.invalidate()
            call.resolve(["extractedFiles": result.extractedFiles, "tilesDir": result.tilesDir])
        } catch {
            call.reject("Tile extraction failed: \(error.localizedDescription)", nil, error)
        }
    }

    /// The ids routing tiles are kept under, so that the app can tell what it can route in without
    /// keeping a list of its own.
    @objc func listIds(_ call: CAPPluginCall) {
        call.resolve(["ids": tiles.ids()])
    }

    /// Removes the routing tiles kept under an id, keeping the ones that are also kept under another id.
    @objc func deleteById(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else {
            call.reject("id is required")
            return
        }
        tiles.delete(id: id)
        router.invalidate()
        call.resolve()
    }

    /// Keeps the routing profiles, as the app downloaded them, so that a route uses the same costing
    /// options the server would have used.
    @objc func storeProfiles(_ call: CAPPluginCall) {
        guard let content = call.getString("profiles"), !content.isEmpty else {
            call.reject("profiles is required")
            return
        }
        do {
            try profiles.store(content)
            call.resolve()
        } catch {
            call.reject("Failed to store the routing profiles: \(error.localizedDescription)", nil, error)
        }
    }

    /// Removes the routing tiles kept under every id.
    @objc func deleteAll(_ call: CAPPluginCall) {
        do {
            try tiles.clear()
            router.invalidate()
            call.resolve()
        } catch {
            call.reject("Failed to clear the tiles: \(error.localizedDescription)", nil, error)
        }
    }

    /// Calculates a route between two points, returns the raw valhalla response json.
    @objc func route(_ call: CAPPluginCall) {
        guard let fromLat = call.getDouble("fromLat") else {
            call.reject("fromLat is required")
            return
        }
        guard let fromLng = call.getDouble("fromLng") else {
            call.reject("fromLng is required")
            return
        }
        guard let toLat = call.getDouble("toLat") else {
            call.reject("toLat is required")
            return
        }
        guard let toLng = call.getDouble("toLng") else {
            call.reject("toLng is required")
            return
        }
        guard let profile = call.getString("profile"), !profile.isEmpty else {
            call.reject("profile is required")
            return
        }
        guard tiles.hasTiles() else {
            call.reject("There are no valhalla tiles on the device")
            return
        }
        do {
            let raw = try router.route(
                ValhallaRouteRequest(
                    fromLat: fromLat,
                    fromLng: fromLng,
                    toLat: toLat,
                    toLng: toLng,
                    profile: profile,
                    elevationInterval: call.getInt("elevationInterval") ?? 0
                )
            )
            call.resolve(["raw": raw])
        } catch {
            call.reject("Valhalla route failed: \(ValhallaPlugin.describe(error))", nil, error)
        }
    }

    /// What went wrong, in a way that can be read. This plugin's errors are swift enums with no
    /// descriptions of their own, and localizedDescription says nothing about such an error beyond which
    /// case it was - as in "(App.ValhallaRouterError error 1.)" - while what actually went wrong, such as
    /// the profile that was not found, is in the case itself.
    private static func describe(_ error: Error) -> String {
        String(describing: error)
    }
}
