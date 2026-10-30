import { Service } from "@angular/core";

import { SpatialHelper } from "./spatial.helper";
import type { LatLngAltTime } from "../models";

/** A position in the trail: when it arrived, and the distance in meters counted up to it. */
type PacePoint = {
    timestamp: number;
    distance: number;
};

/** The length of the trail of positions the pace is measured over. */
const PACE_WINDOW_IN_MILLISECONDS = 2 * 60 * 1000;

/** How far a position has to be from the last counted one to count, so GPS wander is not movement. */
const MINIMAL_MOVEMENT_IN_METERS = 10;

/** Below this pace the user is resting rather than moving slowly. */
const MINIMAL_PACE_IN_METERS_PER_SECOND = 0.15;

/**
 * How fast the user is going, measured from the positions of the last {@link PACE_WINDOW_IN_MILLISECONDS}
 * rather than read off the speed the GPS reports, which jumps between fixes, or off a whole recording,
 * which never forgets the drive to the trailhead. Mirrors CarPaceCalculator on Android and iOS.
 */
@Service()
export class PaceCalculatorService {

    private trail: PacePoint[] = [];
    private lastCountedPosition: LatLngAltTime = null;
    private countedDistance = 0;
    /**
     * The pace, in meters per second, measured the last time the user was moving, so a rest holds the
     * ETA instead of losing it. Until the trail is long enough to measure one, the speed the GPS reported.
     */
    private speed: number = null;

    /**
     * The time in seconds to cover the given distance at the recent pace, or null before there is one.
     *
     * @param distance - the distance in meters left to the end of the route
     */
    public getRemainingTimeInSeconds(distance: number): number {
        if (!distance || this.speed == null) {
            return null;
        }
        return distance / this.speed;
    }

    /**
     * Adds a position to the trail the pace is measured from. A position that did not move counts
     * towards the time but not the distance, so that a rest is measured as a rest, and the trail is
     * kept short so that a rest is forgotten soon after the walk resumes.
     *
     * @param center - the position the GPS reported
     * @param timestamp - when it was reported
     * @param reportedSpeed - the speed in meters per second the GPS reported, which is what the ETA
     * uses until the trail is long enough to measure a pace of its own
     */
    public updatePace(center: LatLngAltTime, timestamp: number, reportedSpeed: number) {
        const distance = this.lastCountedPosition == null
            ? 0
            : SpatialHelper.getDistanceInMeters(this.lastCountedPosition, center);
        if (this.lastCountedPosition == null || distance >= MINIMAL_MOVEMENT_IN_METERS) {
            this.countedDistance += distance;
            this.lastCountedPosition = center;
        }
        this.trail.push({ timestamp, distance: this.countedDistance });
        while (this.trail.length > 2 && timestamp - this.trail[1].timestamp >= PACE_WINDOW_IN_MILLISECONDS) {
            this.trail.shift();
        }
        const first = this.trail[0];
        const last = this.trail[this.trail.length - 1];
        const duration = (last.timestamp - first.timestamp) / 1000;
        const measured = duration <= 0 ? null : (last.distance - first.distance) / duration;
        if (measured > MINIMAL_PACE_IN_METERS_PER_SECOND) {
            this.speed = measured;
        } else if (this.speed == null && reportedSpeed > MINIMAL_PACE_IN_METERS_PER_SECOND) {
            this.speed = reportedSpeed;
        }
    }

    public clear() {
        this.trail = [];
        this.lastCountedPosition = null;
        this.countedDistance = 0;
        this.speed = null;
    }
}
