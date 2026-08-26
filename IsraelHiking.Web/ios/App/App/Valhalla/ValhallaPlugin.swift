import Capacitor
import Foundation

/**
 * Offline routing using the native Valhalla engine against tiles that were downloaded and extracted
 * on the device. The capacitor bridge mirrors `ValhallaPlugin.kt` method for method.
 *
 * This is a self contained plugin so that it can later be moved out into its own capacitor plugin -
 * it must not depend on anything else in the app.
 */
@objc(ValhallaPlugin)
public class ValhallaPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ValhallaPlugin"
    public let jsName = "Valhalla"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "extractFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storeProfiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listTiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteTile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearTiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "route", returnType: CAPPluginReturnPromise)
    ]

    private let tiles = ValhallaTiles()
    private let profiles = ValhallaProfiles()
    private lazy var router = ValhallaRouter(tiles: tiles)

    /**
     * Extracts a downloaded file of routing tiles into the shared tiles directory.
     * Extracting the files of several adjacent tiles into it is the way to route across them.
     * The tileKey identifies the tile the file belongs to, so that it can later be removed on its own.
     */
    @objc func extractFile(_ call: CAPPluginCall) {
        guard let tarFileName = call.getString("tarFileName"), !tarFileName.isEmpty else {
            call.reject("tarFileName is required")
            return
        }
        guard let tileKey = call.getString("tileKey"), !tileKey.isEmpty else {
            call.reject("tileKey is required")
            return
        }
        do {
            let result = try tiles.extract(tarFileName: tarFileName, tileKey: tileKey)
            router.invalidate()
            call.resolve(["extractedFiles": result.extractedFiles, "tilesDir": result.tilesDir])
        } catch {
            call.reject("Tile extraction failed: \(error.localizedDescription)", nil, error)
        }
    }

    /**
     * The keys of the tiles whose routing tiles are on the device, so that the app can tell which
     * areas it can route in without keeping a list of its own.
     */
    @objc func listTiles(_ call: CAPPluginCall) {
        call.resolve(["tileKeys": tiles.tileKeys()])
    }

    /**
     * Removes the routing tiles of a single tile, keeping the ones its neighbours share with it.
     */
    @objc func deleteTile(_ call: CAPPluginCall) {
        guard let tileKey = call.getString("tileKey"), !tileKey.isEmpty else {
            call.reject("tileKey is required")
            return
        }
        tiles.delete(tileKey: tileKey)
        router.invalidate()
        call.resolve()
    }

    /**
     * Keeps the routing profiles, as the app downloaded them, so that a route uses the same costing
     * options the server would have used.
     */
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

    /**
     * Removes all the extracted tiles.
     */
    @objc func clearTiles(_ call: CAPPluginCall) {
        do {
            try tiles.clear()
            router.invalidate()
            call.resolve()
        } catch {
            call.reject("Failed to clear the tiles: \(error.localizedDescription)", nil, error)
        }
    }

    /**
     * Calculates a route between two points, returns the raw valhalla response json.
     */
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

    /**
     * What went wrong, in a way that can be read. The errors of the routing engine and of this plugin are
     * swift enums, and localizedDescription says nothing about those beyond which case it was - as in
     * "(Valhalla.ValhallaError error 1.)" - while the code and the message valhalla answered with, which
     * is the only thing that says why a route was not found, are in the case itself.
     */
    private static func describe(_ error: Error) -> String {
        String(describing: error)
    }
}
