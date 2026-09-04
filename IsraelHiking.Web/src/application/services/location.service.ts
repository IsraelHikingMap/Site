import { EventEmitter, inject, computed, Service } from "@angular/core";
import { Store } from "@ngxs/store";

import { GeoLocationService } from "./geo-location.service";
import { DeviceOrientationService } from "./device-orientation.service";
import { MapService } from "./map.service";
import { LoggingService } from "./logging.service";
import { SelectedRouteService } from "./selected-route.service";
import { SpatialService } from "./spatial.service";
import { RouteStrings } from "./hash.service";
import { SetFollowingAction, SetPannedAction, ToggleDistanceAction } from "../reducers/in-memory.reducer";
import type { ApplicationState, LatLngAltTime } from "../models";

export type LocationWithBearing = {
    center: LatLngAltTime;
    bearing: number;
    accuracy: number;
};

/** A position in the pace trail: when it arrived, and the distance counted up to it. */
type PacePoint = {
    timestamp: number;
    distance: number;
};

/** Everything the ETA is calculated from - see {@link LocationService.getRemainingTimeInSeconds}. */
type PaceState = {
    /** The positions of the last {@link PACE_WINDOW_IN_MILLISECONDS}. */
    trail: PacePoint[];
    /** The last position that was far enough from the one before it to count as movement. */
    lastCountedPosition: LatLngAltTime;
    /** The distance in meters counted since the trail started. */
    distance: number;
    /**
     * The pace measured the last time the user was moving, so a rest holds the ETA instead of
     * losing it. Until the trail is long enough to measure one, the speed the GPS reported.
     */
    speed: number;
};

/** The last speed the GPS reported together with a heading, and when it arrived. */
type GpsSpeedState = {
    speed: number;
    timestamp: number;
};

/** The length of the trail of positions the ETA's pace is measured over. */
const PACE_WINDOW_IN_MILLISECONDS = 15 * 60 * 1000;

/** How far a position has to be from the last counted one to count, so GPS wander is not movement. */
const MINIMAL_MOVEMENT_IN_METERS = 10;

/** Below this pace the user is resting rather than moving slowly. */
const MINIMAL_PACE_IN_METERS_PER_SECOND = 0.15;

/** A gap in the positions longer than this ends the pace trail instead of extending it. */
const MAXIMAL_GAP_IN_MILLISECONDS = 2 * 60 * 1000;

@Service()
export class LocationService {

    public readonly changed = new EventEmitter<LocationWithBearing | null>();
    private lastGpsSpeed: GpsSpeedState = null;
    private locationWithBearing: LocationWithBearing | null = null;
    private pace: PaceState;

    private readonly geoLocationService = inject(GeoLocationService);
    private readonly deviceOrientationService = inject(DeviceOrientationService);
    private readonly mapService = inject(MapService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);
    private readonly inMemoryStateSignal = this.store.selectSignal((state: ApplicationState) => state.inMemoryState);
    private readonly pannedTimestampSignal = this.store.selectSignal((state: ApplicationState) => state.inMemoryState.pannedTimestamp);
    private readonly isPanned = computed(() => this.pannedTimestampSignal() != null);

    public readonly isFollowing = computed(() => {
        const inMemoryState = this.inMemoryStateSignal();
        return inMemoryState.following &&
            !this.isPanned() &&
            !this.selectedRouteService.isEditingRoute() &&
            inMemoryState.currentUrl !== RouteStrings.ROUTE_SHARES &&
            inMemoryState.currentUrl !== RouteStrings.ROUTE_TRACES &&
            inMemoryState.currentUrl !== RouteStrings.ROUTE_PUBLIC_ROUTES;
    });

    constructor() {
        this.clearPace();
    }

    public async initialize() {
        await this.mapService.initializationPromise;
        this.geoLocationService.restoreTracking();
        this.deviceOrientationService.orientationChanged.subscribe((bearing: number) => {
            if (!this.isActive() || this.locationWithBearing == null) {
                return;
            }
            if (this.lastGpsSpeed != null && new Date().getTime() - this.lastGpsSpeed.timestamp < 5000) {
                return;
            }
            this.lastGpsSpeed = null;
            this.locationWithBearing.bearing = bearing;
            this.changed.next(this.locationWithBearing);
            if (!this.mapService.isMoving() && this.isFollowing()) {
                this.moveMapToGpsPosition();
            }
        });

        this.geoLocationService.backToForeground.subscribe(() => {
            if (this.isFollowing()) {
                this.moveMapToGpsPosition();
            }
        });

        this.store.select((state: ApplicationState) => state.inMemoryState.pannedTimestamp).subscribe(pannedTimestamp => {
            if (pannedTimestamp != null) {
                return;
            }
            if (!this.isActive()) {
                return;
            }
            if (this.store.selectSnapshot((state: ApplicationState) => state.inMemoryState).distance) {
                this.store.dispatch(new ToggleDistanceAction());
            }
            if (this.isFollowing()) {
                this.moveMapToGpsPosition();
            }
        });

        this.store.select((state: ApplicationState) => state.gpsState.currentPosition).subscribe(position => {
            if (position != null) {
                this.handlePositionChange(position);
            }
        });
    }

    public async disable() {
        await this.geoLocationService.disable();
        await this.deviceOrientationService.disable();
        this.locationWithBearing = null;
        this.clearPace();
        this.changed.next(this.locationWithBearing);
    }

    public enable() {
        this.geoLocationService.enable();
        this.deviceOrientationService.enable();
        this.store.dispatch(new SetFollowingAction(true));
        this.store.dispatch(new SetPannedAction(null));
    }

    public isActive() {
        return this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "tracking";
    }

    public getLocationCenter(): LatLngAltTime | null {
        return this.locationWithBearing?.center;
    }

    public moveMapToGpsPosition() {
        if (this.locationWithBearing == null) {
            return;
        }
        const center = this.locationWithBearing.center;
        const bearing = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState).keepNorthUp
            ? 0
            : this.locationWithBearing.bearing;
        this.mapService.moveToWithCurrentZoom(center, bearing);
    }

    private handlePositionChange(position: GeolocationPosition) {
        if (this.locationWithBearing == null) {
            this.store.dispatch(new SetFollowingAction(true));
        }
        const validHeading = !isNaN(position.coords.heading) && position.coords.speed !== 0;
        let bearing = this.locationWithBearing?.bearing || 0;
        if (validHeading) {
            this.lastGpsSpeed = { speed: position.coords.speed, timestamp: new Date().getTime() };
            bearing = position.coords.heading;
        }
        if (isNaN(position.coords.latitude) || isNaN(position.coords.longitude)) {
            this.loggingService.warning("[Location] Ignoring invalid position: " + JSON.stringify(position));
            return;
        }
        this.locationWithBearing = {
            center: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                alt: position.coords.altitude
            },
            bearing,
            accuracy: position.coords.accuracy
        };
        this.updatePace(this.locationWithBearing.center, position.timestamp, position.coords.speed);
        this.changed.next(this.locationWithBearing);
        if (!this.mapService.isMoving() && this.isFollowing()) {
            this.moveMapToGpsPosition();
        }
    }

    /**
     * The time in seconds to cover the given distance at the recent pace, or null before there is one.
     * The pace is measured from the positions rather than from a speed reading, which jumps between
     * fixes, or from a whole recording, which never forgets the drive to the trailhead - the reported
     * speed is only used to answer at all until the trail is long enough to measure one.
     *
     * @param distance - the distance in meters left to the end of the route
     */
    public getRemainingTimeInSeconds(distance: number): number {
        if (!distance || this.pace.speed == null) {
            return null;
        }
        return distance / this.pace.speed;
    }

    /**
     * Adds a position to the trail the pace is measured from. A position that did not move counts
     * towards the time but not the distance, so that a rest is measured as a rest, and a position
     * that arrived after a gap starts a new trail - where the speed it reports carries the ETA
     * until that trail has a pace of its own.
     *
     * @param center - the position the GPS reported
     * @param timestamp - when it was reported
     * @param reportedSpeed - the speed in meters per second the GPS reported, which is what the ETA
     * uses until the trail is long enough to measure a pace of its own
     */
    private updatePace(center: LatLngAltTime, timestamp: number, reportedSpeed: number) {
        if (this.isAfterGap(timestamp)) {
            this.clearPace();
        }
        const distance = this.pace.lastCountedPosition == null
            ? 0
            : SpatialService.getDistanceInMeters(this.pace.lastCountedPosition, center);
        if (this.pace.lastCountedPosition == null || distance >= MINIMAL_MOVEMENT_IN_METERS) {
            this.pace.distance += distance;
            this.pace.lastCountedPosition = center;
        }
        this.pace.trail.push({ timestamp, distance: this.pace.distance });
        while (this.pace.trail.length > 2 && timestamp - this.pace.trail[1].timestamp >= PACE_WINDOW_IN_MILLISECONDS) {
            this.pace.trail.shift();
        }
        const first = this.pace.trail[0];
        const last = this.pace.trail[this.pace.trail.length - 1];
        const duration = (last.timestamp - first.timestamp) / 1000;
        const speed = duration <= 0 ? null : (last.distance - first.distance) / duration;
        if (speed > MINIMAL_PACE_IN_METERS_PER_SECOND) {
            this.pace.speed = speed;
        } else if (this.pace.speed == null && reportedSpeed > MINIMAL_PACE_IN_METERS_PER_SECOND) {
            this.pace.speed = reportedSpeed;
        }
    }

    /**
     * Whether the given position arrived too long after the last one for the two to be part of the
     * same trail - see {@link MAXIMAL_GAP_IN_MILLISECONDS}.
     */
    private isAfterGap(timestamp: number): boolean {
        const lastInTrail = this.pace.trail[this.pace.trail.length - 1];
        return lastInTrail != null && timestamp - lastInTrail.timestamp > MAXIMAL_GAP_IN_MILLISECONDS;
    }

    private clearPace() {
        this.pace = { trail: [], lastCountedPosition: null, distance: 0, speed: null };
    }

    public async uninitialize() {
        await this.geoLocationService.uninitialize();
        await this.deviceOrientationService.disable();
    }
}