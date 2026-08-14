import Foundation

/**
 * A single routing profile: the valhalla costing model and the costing options to use with it.
 */
struct ValhallaProfile {
    let costing: String
    let costingOptions: [String: Any]?
}

enum ValhallaProfilesError: Error {
    case invalidProfiles
}

/**
 * The routing profiles on the device, stored next to the tiles, mirroring `ValhallaProfiles.kt`.
 *
 * They are the same profiles the server routes with, so that a route calculated on the device
 * follows the same costing options as one calculated online. When there is no profiles file, or it
 * holds no such profile, the caller's costing model is used with valhalla's own defaults.
 */
final class ValhallaProfiles {
    private static let profilesFileName = "valhalla_profiles.json"
    private static let costingKey = "costing"
    private static let costingOptionsKey = "costingOptions"

    private let fileManager = FileManager.default

    private var profilesURL: URL {
        fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(ValhallaProfiles.profilesFileName)
    }

    /**
     * Stores the profiles file as it was served, it is parsed only when a route is calculated.
     */
    func store(_ profiles: String) throws {
        // Fail here rather than when routing, so that bad content is never stored
        guard let data = profiles.data(using: .utf8),
              (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] != nil else {
            throw ValhallaProfilesError.invalidProfiles
        }
        try data.write(to: profilesURL, options: .atomic)
    }

    func clear() {
        try? fileManager.removeItem(at: profilesURL)
    }

    /**
     * The profile of the given name, or nil when there are no profiles or no such profile in them.
     */
    func profile(named name: String) -> ValhallaProfile? {
        guard let data = try? Data(contentsOf: profilesURL),
              let profiles = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let profile = profiles[name] as? [String: Any],
              let costing = profile[ValhallaProfiles.costingKey] as? String, !costing.isEmpty else {
            return nil
        }
        return ValhallaProfile(costing: costing, costingOptions: profile[ValhallaProfiles.costingOptionsKey] as? [String: Any])
    }
}
