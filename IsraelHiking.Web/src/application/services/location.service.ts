import { EventEmitter, inject, Injectable } from "@angular/core";
import { Store } from "@ngxs/store";

import { GeoLocationService } from "./geo-location.service";
import { DeviceOrientationService } from "./device-orientation.service";
import { FitBoundsService } from "./fit-bounds.service";
import { MapService } from "./map.service";
import { LoggingService } from "./logging.service";
import { SelectedRouteService } from "./selected-route.service";
import { SetFollowingAction, SetPannedAction, ToggleDistanceAction } from "../reducers/in-memory.reducer";
import type { ApplicationState, LatLngAltTime } from "../models";

export type LocationWithBearing = {
    center: LatLngAltTime;
    bearing: number;
    accuracy: number;
};

@Injectable()
export class LocationService {
    private readonly geoLocationService = inject(GeoLocationService);
    private readonly deviceOrientationService = inject(DeviceOrientationService);
    private readonly fitBoundsService = inject(FitBoundsService);
    private readonly mapService = inject(MapService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);

    public changed = new EventEmitter<LocationWithBearing | null>();
    private lastSpeed: number = null;
    private lastSpeedTime: number = null;
    private locationWithBearing: LocationWithBearing | null = null;
    private isPanned: boolean = false;

    public async initialize() {
        await this.mapService.initializationPromise;
        this.deviceOrientationService.orientationChanged.subscribe((bearing: number) => {
            if (!this.isActive() || this.locationWithBearing == null) {
                return;
            }
            if (this.lastSpeed != null && new Date().getTime() - this.lastSpeedTime < 5000) {
                return;
            }
            this.lastSpeed = null;
            this.locationWithBearing.bearing = bearing;
            this.changed.next(this.locationWithBearing);
            if (!this.mapService.map.isMoving() && this.isFollowing() && !this.selectedRouteService.isEditingRoute()) {
                this.moveMapToGpsPosition();
            }
        });

        this.geoLocationService.backToForeground.subscribe(() => {
            if (this.isFollowing() && !this.selectedRouteService.isEditingRoute()) {
                this.moveMapToGpsPosition();
            }
        });

        this.store.select((state: ApplicationState) => state.inMemoryState.pannedTimestamp).subscribe(pannedTimestamp => {
            this.isPanned = pannedTimestamp != null;
            if (this.isPanned) {
                return;
            }
            if (!this.isActive()) {
                return;
            }
            if (this.store.selectSnapshot((state: ApplicationState) => state.inMemoryState).distance) {
                this.store.dispatch(new ToggleDistanceAction());
            }
            if (this.isFollowing() && !this.selectedRouteService.isEditingRoute()) {
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

    public isFollowing(): boolean {
        return this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState).following && !this.isPanned;
    }

    public moveMapToGpsPosition() {
        if (this.locationWithBearing == null) {
            return;
        }
        const center = this.locationWithBearing.center;
        const bearing = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState).keepNorthUp
            ? 0
            : this.locationWithBearing.bearing;
        this.fitBoundsService.moveTo(center, this.mapService.map.getZoom(), bearing);
    }

    private handlePositionChange(position: GeolocationPosition) {
        if (this.locationWithBearing == null) {
            this.store.dispatch(new SetFollowingAction(true));
        }
        const validHeading = !isNaN(position.coords.heading) && position.coords.speed !== 0;
        let bearing = this.locationWithBearing?.bearing || 0;
        if (validHeading) {
            this.lastSpeed = position.coords.speed;
            this.lastSpeedTime = new Date().getTime();
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
        this.changed.next(this.locationWithBearing);
        if (!this.mapService.map.isMoving() && this.isFollowing() && !this.selectedRouteService.isEditingRoute()) {
            this.moveMapToGpsPosition();
        }
    }

    public async uninitialize() {
        await this.geoLocationService.uninitialize();
        await this.deviceOrientationService.disable();
    }
}