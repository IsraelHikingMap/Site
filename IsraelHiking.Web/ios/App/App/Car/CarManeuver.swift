import CoreLocation
import Foundation
import UIKit
import ValhallaModels

/**
 * The normalized, engine-agnostic maneuver kinds shared with the backend v2 instructions model
 * (mirrors `RouteManeuverType` in `CarManeuver.kt` and IsraelHiking.Common.Api.ManeuverType).
 *
 * Android pairs each kind with an `androidx.car.app` maneuver type that the host draws. CarPlay has
 * no such vocabulary - a `CPManeuver` carries an image the app supplies - so each kind is paired
 * with the SF Symbol that stands for it instead. Kinds without a turn of their own
 * (continue / roundabout-exit / ferry-exit, and any unknown future kind) read as going straight.
 */
enum CarManeuverType: String, CaseIterable {
    case depart = "depart"
    case arrive = "arrive"
    case slightLeft = "slight-left"
    case left = "left"
    case sharpLeft = "sharp-left"
    case uturnLeft = "uturn-left"
    case slightRight = "slight-right"
    case right = "right"
    case sharpRight = "sharp-right"
    case uturnRight = "uturn-right"
    case keepLeft = "keep-left"
    case keepRight = "keep-right"
    case rampLeft = "ramp-left"
    case rampRight = "ramp-right"
    case merge = "merge"
    case roundabout = "roundabout"
    case ferryEnter = "ferry-enter"
    case continueStraight = "continue"

    /// Resolves a wire value, mapping unknown/forward-compatible kinds to `continueStraight`.
    static func fromWire(_ wire: String) -> CarManeuverType {
        CarManeuverType(rawValue: wire) ?? .continueStraight
    }

    /**
     * Resolves one of valhalla's numeric maneuver types, which is what an offline trace returns,
     * the same way the backend resolves it for the v2 instructions (see
     * ValhallaGateway.ToManeuverType). Kinds without a turn of their own - continue, becomes, the
     * exit of a roundabout or of a ferry, and transit - fall through to `continueStraight`.
     */
    static func fromValhalla(_ type: Int) -> CarManeuverType {
        switch type {
        case 1, 2, 3: return .depart
        case 4, 5, 6: return .arrive
        case 9: return .slightRight
        case 10: return .right
        case 11: return .sharpRight
        case 12: return .uturnRight
        case 13: return .uturnLeft
        case 14: return .sharpLeft
        case 15: return .left
        case 16: return .slightLeft
        case 18, 20: return .rampRight
        case 19, 21: return .rampLeft
        case 23: return .keepRight
        case 24: return .keepLeft
        case 25, 37, 38: return .merge
        case 26: return .roundabout
        case 28: return .ferryEnter
        default: return .continueStraight
        }
    }

    /// The SF Symbol the CarPlay maneuver is drawn with.
    var symbolName: String {
        switch self {
        case .depart, .continueStraight: return "arrow.up"
        case .arrive: return "flag.checkered"
        case .slightLeft, .keepLeft: return "arrow.up.left"
        case .left, .sharpLeft, .rampLeft: return "arrow.turn.up.left"
        case .uturnLeft: return "arrow.uturn.left"
        case .slightRight, .keepRight: return "arrow.up.right"
        case .right, .sharpRight, .rampRight: return "arrow.turn.up.right"
        case .uturnRight: return "arrow.uturn.right"
        case .merge: return "arrow.triangle.merge"
        case .roundabout: return "arrow.triangle.turn.up.right.circle"
        case .ferryEnter: return "ferry"
        }
    }

    /// The symbol image for the maneuver, falling back to a straight arrow for any symbol this
    /// system does not know, so an unrecognized glyph never leaves the cluster without an icon.
    var symbolImage: UIImage? {
        UIImage(systemName: symbolName) ?? UIImage(systemName: "arrow.up")
    }
}

/**
 * Mirrors `CarManeuver.kt`: a turn along the route. CarPlay requires navigation apps to provide
 * turn-by-turn directions. These come from the map-match backend when available
 * (see `fromInstructions`) and otherwise fall back to turns synthesized from the polyline geometry
 * (see `CarManeuverGenerator`).
 *
 * `cue` is the instruction text: backend instructions are already localized and used as-is, while
 * synthesized cues are English `Translations` keys (translation falls back to the key itself).
 * `distanceAlongRouteM` is measured from the start of the route. `roundaboutExitNumber` is set only
 * for roundabout maneuvers, nil otherwise.
 */
struct CarManeuver {
    let type: CarManeuverType
    let cue: String
    let distanceAlongRouteM: Double
    let roundaboutExitNumber: Int?

    init(type: CarManeuverType, cue: String, distanceAlongRouteM: Double, roundaboutExitNumber: Int? = nil) {
        self.type = type
        self.cue = cue
        self.distanceAlongRouteM = distanceAlongRouteM
        self.roundaboutExitNumber = roundaboutExitNumber
    }

    var asJson: [String: Any] {
        var json: [String: Any] = [
            "type": type.rawValue,
            "cue": cue,
            "distanceAlongRouteM": distanceAlongRouteM
        ]
        if let roundaboutExitNumber = roundaboutExitNumber {
            json["roundaboutExitNumber"] = roundaboutExitNumber
        }
        return json
    }

    static func from(_ json: [String: Any]) -> CarManeuver? {
        guard let type = json["type"] as? String,
              let cue = json["cue"] as? String,
              let distance = (json["distanceAlongRouteM"] as? NSNumber)?.doubleValue
        else { return nil }
        return CarManeuver(
            type: CarManeuverType.fromWire(type),
            cue: cue,
            distanceAlongRouteM: distance,
            roundaboutExitNumber: (json["roundaboutExitNumber"] as? NSNumber)?.intValue
        )
    }

    private static let metersInKilometer = 1000.0

    /**
     * Build maneuvers from the v2 `instructions` array returned by the map-match endpoint
     * (requested with instructionsFormat=v2). Each instruction carries the length of its own
     * segment in `distanceMeters`; the maneuver is performed at the start of that segment, so its
     * distance-from-start is the running total of the preceding instructions' lengths. `text` is
     * already localized by the backend (the language is sent with the request), so it is used
     * directly as the cue.
     */
    static func fromInstructions(_ instructions: [[String: Any]]) -> [CarManeuver] {
        var maneuvers: [CarManeuver] = []
        var cumulative = 0.0
        for instruction in instructions {
            let type = (instruction["type"] as? String) ?? ""
            let text = (instruction["text"] as? String) ?? ""
            let exitNumber = (instruction["roundaboutExitNumber"] as? NSNumber)?.intValue
            maneuvers.append(toManeuver(CarManeuverType.fromWire(type), text, cumulative, exitNumber))
            cumulative += (instruction["distanceMeters"] as? NSNumber)?.doubleValue ?? 0
        }
        return maneuvers
    }

    /**
     * Build maneuvers from valhalla's own maneuvers, as they come back from an offline trace. This
     * is the very same conversion the backend does for the v2 instructions above, so a route matched
     * on the device gets the same turns as one matched by the server: the kind of turn comes from
     * valhalla's numeric maneuver type, its instruction is already localized by the engine, and its
     * length - which valhalla gives in the requested units, kilometers - is the length of the
     * segment that starts at it.
     */
    static func fromValhallaManeuvers(_ maneuvers: [RouteManeuver]) -> [CarManeuver] {
        var result: [CarManeuver] = []
        var cumulative = 0.0
        for maneuver in maneuvers {
            result.append(toManeuver(CarManeuverType.fromValhalla(maneuver.type),
                                     maneuver.instruction,
                                     cumulative,
                                     maneuver.roundaboutExitCount))
            cumulative += maneuver.length * metersInKilometer
        }
        return result
    }

    /**
     * Builds a single maneuver. A roundabout needs a valid exit number (>= 1) to read as one, so
     * without one it falls back to a plain straight maneuver.
     */
    private static func toManeuver(_ type: CarManeuverType,
                                   _ text: String,
                                   _ distanceAlongRouteM: Double,
                                   _ exitNumber: Int?) -> CarManeuver {
        if type == .roundabout {
            guard let exitNumber = exitNumber, exitNumber >= 1 else {
                return CarManeuver(type: .continueStraight, cue: text, distanceAlongRouteM: distanceAlongRouteM)
            }
            return CarManeuver(type: type, cue: text, distanceAlongRouteM: distanceAlongRouteM,
                               roundaboutExitNumber: exitNumber)
        }
        return CarManeuver(type: type, cue: text, distanceAlongRouteM: distanceAlongRouteM)
    }
}

/// Mirrors `CarManeuverGenerator`: turns a route polyline into an ordered list of `CarManeuver`s
/// (depart … turns … destination).
enum CarManeuverGenerator {
    private static let minTurnDegrees = 30.0
    private static let slightMaxDegrees = 45.0
    private static let normalMaxDegrees = 120.0
    private static let sharpMaxDegrees = 160.0
    /// Don't emit two maneuvers closer than this - collapses shape-point jitter into one turn.
    private static let minSpacingMeters = 25.0

    /**
     * Show locally-synthesized turns right away. These are deliberately never cached, so every
     * launch re-fetches from the backend; the cache is only consulted if that fetch fails.
     */
    static func generate(_ route: [CLLocationCoordinate2D]) -> [CarManeuver] {
        guard route.count >= 2 else { return [] }
        var maneuvers: [CarManeuver] = [
            CarManeuver(type: .depart, cue: "Head out", distanceAlongRouteM: 0)
        ]
        var cumulative = 0.0
        var lastTurnAt = 0.0
        for index in 1..<(route.count - 1) {
            cumulative += SpatialHelper.distanceMeters(route[index - 1], route[index])
            let delta = normalize(
                SpatialHelper.bearingDegrees(route[index], route[index + 1])
                    - SpatialHelper.bearingDegrees(route[index - 1], route[index]))
            let magnitude = abs(delta)
            if magnitude < minTurnDegrees { continue }
            if cumulative - lastTurnAt < minSpacingMeters { continue }
            let right = delta > 0
            maneuvers.append(CarManeuver(type: maneuverType(magnitude, right),
                                         cue: cue(magnitude, right),
                                         distanceAlongRouteM: cumulative))
            lastTurnAt = cumulative
        }
        cumulative += SpatialHelper.distanceMeters(route[route.count - 2], route[route.count - 1])
        maneuvers.append(CarManeuver(type: .arrive, cue: "Arrive at destination",
                                     distanceAlongRouteM: cumulative))
        return maneuvers
    }

    private static func maneuverType(_ magnitude: Double, _ right: Bool) -> CarManeuverType {
        if magnitude < slightMaxDegrees { return right ? .slightRight : .slightLeft }
        if magnitude < normalMaxDegrees { return right ? .right : .left }
        if magnitude < sharpMaxDegrees { return right ? .sharpRight : .sharpLeft }
        return right ? .uturnRight : .uturnLeft
    }

    private static func cue(_ magnitude: Double, _ right: Bool) -> String {
        if magnitude < slightMaxDegrees { return right ? "Slight right" : "Slight left" }
        if magnitude < sharpMaxDegrees { return right ? "Turn right" : "Turn left" }
        return "Make a U-turn"
    }

    /// Wrap a bearing difference into [-180, 180]; positive is a right turn.
    private static func normalize(_ angle: Double) -> Double {
        (angle + 540).truncatingRemainder(dividingBy: 360) - 180
    }
}
