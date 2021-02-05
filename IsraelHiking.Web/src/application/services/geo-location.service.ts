import { Injectable, EventEmitter, NgZone } from "@angular/core";
import {
    BackgroundGeolocation,
    BackgroundGeolocationEvents,
    BackgroundGeolocationResponse,
    BackgroundGeolocationLocationProvider,
    // BackgroundGeolocationAccuracy,
    BackgroundGeolocationLogLevel
} from "@ionic-native/background-geolocation/ngx";

import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { NgRedux } from "../reducers/infra/ng-redux.module";
import { SetGeoLocationStateAction } from "../reducers/in-memory.reducer";
import { ApplicationState, ILatLngTime } from "../models/models";

@Injectable()
export class GeoLocationService {
    private static readonly TIME_OUT = 30000;
    private static readonly SHORT_TIME_OUT = 10000; // Only for first position for good UX

    private watchNumber: number;
    private isBackground: boolean;
    private wasInitialized: boolean;

    public positionChanged: EventEmitter<Position>;
    public bulkPositionChanged: EventEmitter<Position[]>;
    public currentLocation: ILatLngTime;

    constructor(private readonly resources: ResourcesService,
                private readonly backgroundGeolocation: BackgroundGeolocation,
                private readonly runningContextService: RunningContextService,
                private readonly loggingService: LoggingService,
                private readonly toastService: ToastService,
                private readonly ngZone: NgZone,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.watchNumber = -1;
        this.positionChanged = new EventEmitter<Position>();
        this.bulkPositionChanged = new EventEmitter<Position[]>();
        this.isBackground = false;
        this.currentLocation = null;
        this.wasInitialized = false;
    }

    public enable() {
        switch (this.ngRedux.getState().inMemoryState.geoLocation) {
            case "disabled":
                this.startWatching();
                return;
            case "searching":
            case "tracking":
                return;

        }
    }

    public async disable() {
        switch (this.ngRedux.getState().inMemoryState.geoLocation) {
            case "disabled":
                return;
            case "searching":
            case "tracking":
                await this.stopWatching();
                return;
        }
    }

    public canRecord(): boolean {
        return this.ngRedux.getState().inMemoryState.geoLocation === "tracking"
            && this.currentLocation != null && this.runningContextService.isCordova;
    }

    private startWatching() {
        this.ngRedux.dispatch(new SetGeoLocationStateAction({ state: "searching"}));
        if (window.navigator && window.navigator.geolocation) {
            // Upon starting location watching get the current position as fast as we can, even if not accurate.
            window.navigator.geolocation.getCurrentPosition((position: Position) => {
                this.handlePoistionChange(position);
            }, () => {}, { timeout: GeoLocationService.SHORT_TIME_OUT });
        }
        if (this.runningContextService.isCordova) {
            this.startBackgroundGeolocation();

        } else {
            this.startNavigator();
        }
    }

    private startNavigator() {
        this.loggingService.info("[GeoLocation] Starting browser tracking");
        if (!window.navigator || !window.navigator.geolocation) {
            return;
        }
        if (this.watchNumber !== -1) {
            return;
        }
        this.watchNumber = window.navigator.geolocation.watchPosition(
            (position: Position): void => this.handlePoistionChange(position),
            (err) => {
                this.ngZone.run(() => {
                    this.loggingService.error("[GeoLocation] Failed to start tracking " + JSON.stringify(err));
                    this.toastService.warning(this.resources.unableToFindYourLocation);
                    this.disable();
                });
            },
            {
                enableHighAccuracy: true,
                timeout: GeoLocationService.TIME_OUT
            });
    }

    private startBackgroundGeolocation() {
        if (this.wasInitialized) {
            this.backgroundGeolocation.start();
            return;
        }
        this.wasInitialized = true;
        this.backgroundGeolocation.configure({
            locationProvider: BackgroundGeolocationLocationProvider.RAW_PROVIDER,
            desiredAccuracy: 0, // BackgroundGeolocationAccuracy.HIGH,
            stationaryRadius: 10,
            distanceFilter: 5,
            notificationTitle: this.resources.israelHikingMap,
            notificationText: this.resources.runningInBackground,
            interval: 1000,
            fastestInterval: 1000,
            activitiesInterval: 10000,
            startForeground: true
        });

        this.backgroundGeolocation.on(BackgroundGeolocationEvents.location).subscribe(async (_: BackgroundGeolocationResponse) => {
            if (this.isBackground) {
                return;
            }
            let locations = await this.backgroundGeolocation.getValidLocations() as BackgroundGeolocationResponse[];
            this.backgroundGeolocation.deleteAllLocations();
            let positions = locations.map(l => this.locationToPosition(l));
            if (positions.length === 0) {
                this.loggingService.debug(`[GeoLocation] There's nothing to send - valid locations array is empty`);
            } else if (positions.length === 1) {
                this.loggingService.debug(`[GeoLocation] Sending a location update`);
                this.handlePoistionChange(positions[positions.length - 1]);
            } else {
                this.loggingService.debug(`[GeoLocation] Sending bulk location update on each location update: ${positions.length}`);
                this.bulkPositionChanged.next(positions.splice(0, positions.length - 1));
                this.handlePoistionChange(positions[0]);
            }
        });

        this.backgroundGeolocation.on(BackgroundGeolocationEvents.start).subscribe(
            () => {
                this.loggingService.debug("[GeoLocation] Start service");
            });

        this.backgroundGeolocation.on(BackgroundGeolocationEvents.stop).subscribe(
            () => {
                this.loggingService.debug("[GeoLocation] Stop service");
            });

        this.backgroundGeolocation.on(BackgroundGeolocationEvents.background).subscribe(
            () => {
                this.isBackground = true;
                this.loggingService.debug("[GeoLocation] Now in background, deleting locations");
                this.backgroundGeolocation.deleteAllLocations();
            });

        this.backgroundGeolocation.on(BackgroundGeolocationEvents.foreground).subscribe(
            async () => {
                this.loggingService.debug("[GeoLocation] Now in foreground");
                let locations = await this.backgroundGeolocation.getValidLocations() as BackgroundGeolocationResponse[];
                this.backgroundGeolocation.deleteAllLocations();
                this.isBackground = false;
                let positions = locations.map(l => this.locationToPosition(l));
                if (positions.length > 0) {
                    this.loggingService.debug(`[GeoLocation] Sending bulk location update: ${positions.length}`);
                    this.currentLocation = this.positionToLatLngTime(positions[positions.length - 1]);
                    this.bulkPositionChanged.next(positions);
                }
            });
        this.backgroundGeolocation.start();
    }

    private async stopWatching() {
        this.ngRedux.dispatch(new SetGeoLocationStateAction({ state: "disabled"}));
        this.currentLocation = null;
        this.positionChanged.next(null);
        if (this.runningContextService.isCordova) {
            this.loggingService.debug("[GeoLocation] Stopping background tracking");
            await this.backgroundGeolocation.stop();
        } else {
            this.loggingService.debug("[GeoLocation] Stopping browser tracking: " + this.watchNumber);
            this.stopNavigator();
        }
    }

    private stopNavigator() {
        if (this.watchNumber !== -1) {
            window.navigator.geolocation.clearWatch(this.watchNumber);
            this.watchNumber = -1;
        }
    }

    private handlePoistionChange(position: Position): void {
        this.ngZone.run(() => {
            this.loggingService.debug("[GeoLocation] Received position: " + JSON.stringify(this.positionToLatLngTime(position)));
            if (this.ngRedux.getState().inMemoryState.geoLocation === "searching") {
                this.ngRedux.dispatch(new SetGeoLocationStateAction({ state: "tracking"}));
            }
            if (this.ngRedux.getState().inMemoryState.geoLocation !== "tracking") {
                return;
            }
            this.currentLocation = this.positionToLatLngTime(position);
            this.positionChanged.next(position);
        });
    }

    public positionToLatLngTime(position: Position): ILatLngTime {
        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude,
            timestamp: new Date(position.timestamp)
        };
    }

    private locationToPosition(location: BackgroundGeolocationResponse): Position {
        return {
            coords: {
                accuracy: location.accuracy,
                altitude: location.altitude,
                latitude: location.latitude,
                longitude: location.longitude,
                speed: location.speed,
                heading: location.bearing
            },
            timestamp: location.time
        } as Position;
    }

    public async getLog(): Promise<string> {
        let logEntries = await this.backgroundGeolocation.getLogEntries(10000, 0, BackgroundGeolocationLogLevel.TRACE);
        return logEntries.map(logLine => {
            let dateString = new Date(logLine.timestamp - new Date().getTimezoneOffset() * 60 * 1000)
                .toISOString().replace(/T/, " ").replace(/\..+/, "");
            return dateString + " | " + logLine.level.padStart(5).toUpperCase() + " | " + logLine.message;
        }).join("\n");
    }
}
