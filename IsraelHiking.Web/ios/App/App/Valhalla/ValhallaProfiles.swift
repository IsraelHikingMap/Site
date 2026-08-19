import Foundation

/**
 * A single routing profile: the valhalla costing model and the costing options to use with it.
 */
enum ValhallaProfilesError: Error {
    case invalidProfiles
}

struct ValhallaProfile {
    let costing: String
    let costingOptions: [String: Any]?
}

/**
 * The routing profiles on the device, mirroring `ValhallaProfiles.kt`.
 *
 * They are handed over after being downloaded with the offline maps, and are the same profiles the
 * server routes with, so that a route on the device follows the same costing options as one online.
 * Without them there is no offline routing, the same as without tiles.
 */
final class ValhallaProfiles {
    /// The plugin's own copy, the app hands it the file it downloaded
    private static let profilesFileName = "valhalla_profiles.json"
    private static let costingKey = "costing"
    private static let costingOptionsKey = "costingOptions"

    private let fileManager = FileManager.default

    private var profilesURL: URL {
        fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(ValhallaProfiles.profilesFileName)
    }

    /**
     * Keeps the profiles as they were downloaded, they are only read when a route is calculated.
     */
    func store(_ profiles: String) throws {
        // Fail here rather than when routing, so that content that can not be read is never kept
        guard let data = profiles.data(using: .utf8),
              (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] != nil else {
            throw ValhallaProfilesError.invalidProfiles
        }
        try data.write(to: profilesURL, options: .atomic)
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
