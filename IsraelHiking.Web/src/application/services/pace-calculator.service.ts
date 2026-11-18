import { Service } from "@angular/core";

/** How many of the latest speeds are averaged. */
const MAXIMAL_SPEEDS = 10;

/** Below this speed the user is resting rather than moving slowly. */
const MINIMAL_MOVING_SPEED_IN_METERS_PER_SECOND = 0.5;

/**
 * How fast the user is going: the average of the last {@link MAXIMAL_SPEEDS} speeds the GPS reported
 * while moving. A single reading jumps between fixes, and readings taken while resting are left out
 * so that a rest holds the ETA instead of pushing it towards never. Mirrors CarPaceCalculator on
 * Android and iOS.
 */
@Service()
export class PaceCalculatorService {

    private speeds: number[] = [];

    /**
     * The time in seconds to cover the given distance at the recent pace, or null before there is one.
     *
     * @param distance - the distance in meters left to the end of the route
     */
    public getRemainingTimeInSeconds(distance: number): number {
        if (!distance || this.speeds.length === 0) {
            return null;
        }
        const speed = this.speeds.reduce((sum, s) => sum + s, 0) / this.speeds.length;
        return distance / speed;
    }

    /**
     * @param reportedSpeed - the speed in meters per second the GPS reported, null when it has none
     */
    public updatePace(reportedSpeed: number) {
        if (!(reportedSpeed > MINIMAL_MOVING_SPEED_IN_METERS_PER_SECOND)) {
            return;
        }
        this.speeds.push(reportedSpeed);
        if (this.speeds.length > MAXIMAL_SPEEDS) {
            this.speeds.shift();
        }
    }

    public clear() {
        this.speeds = [];
    }
}
