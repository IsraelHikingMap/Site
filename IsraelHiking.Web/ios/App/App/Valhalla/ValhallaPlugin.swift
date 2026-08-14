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
        CAPPluginMethod(name: "extractTiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storeProfiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteTiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hasTiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearTiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "route", returnType: CAPPluginReturnPromise)
    ]

    private let tiles = ValhallaTiles()
    private let profiles = ValhallaProfiles()
    private lazy var router = ValhallaRouter(tiles: tiles)

    /**
     * Extracts a downloaded slice of routing tiles into the shared tiles directory.
     * Extracting several adjacent slices into the same directory is the way to route across them.
     * The sliceId identifies the slice so that it can later be removed on its own.
     */
    @objc func extractTiles(_ call: CAPPluginCall) {
        guard let tarFileName = call.getString("tarFileName"), !tarFileName.isEmpty else {
            call.reject("tarFileName is required")
            return
        }
        guard let sliceId = call.getString("sliceId"), !sliceId.isEmpty else {
            call.reject("sliceId is required")
            return
        }
        do {
            let result = try tiles.extract(tarFileName: tarFileName, sliceId: sliceId)
            router.invalidate()
            call.resolve(["extractedFiles": result.extractedFiles, "tilesDir": result.tilesDir])
        } catch {
            call.reject("Tile extraction failed: \(error.localizedDescription)", nil, error)
        }
    }

    /**
     * Removes the tiles of a single slice, keeping the tiles that its neighbours share with it.
     */
    @objc func deleteTiles(_ call: CAPPluginCall) {
        guard let sliceId = call.getString("sliceId"), !sliceId.isEmpty else {
            call.reject("sliceId is required")
            return
        }
        tiles.delete(sliceId: sliceId)
        router.invalidate()
        call.resolve()
    }

    /**
     * Stores the routing profiles next to the tiles, so that a route uses the same costing options
     * the server would have used.
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
     * Whether there are any extracted tiles on the device, i.e. whether offline routing can be attempted.
     */
    @objc func hasTiles(_ call: CAPPluginCall) {
        call.resolve(["hasTiles": tiles.hasTiles()])
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
            call.reject("Valhalla route failed: \(error.localizedDescription)", nil, error)
        }
    }
}
